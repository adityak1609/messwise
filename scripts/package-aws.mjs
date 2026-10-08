import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { zipSync, strToU8, unzipSync } from 'fflate';
import { parseDocument } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.artifacts', 'aws');
await mkdir(output, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const archive = files => zipSync(Object.fromEntries(Object.entries(files).map(([name, bytes]) =>
  [name, [bytes, { mtime: new Date('1980-01-01T00:00:00Z') }]])), { level: 9 });

// Bundle every AWS SDK dependency so the uploaded function has no install step.
const bundled = await build({
  absWorkingDir: root, entryPoints: ['backend/index.mjs'], bundle: true,
  platform: 'node', target: 'node22', format: 'cjs', write: false,
  metafile: true, legalComments: 'eof', outfile: 'index.js',
});
const apiFiles = {
  'index.js': bundled.outputFiles[0].contents,
  'package.json': strToU8(JSON.stringify({ name: 'messwise-api', version: '0.1.0', type: 'commonjs' })),
  'THIRD_PARTY_NOTICES.md': new Uint8Array(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'))),
};
const packageDirs = new Set();
for (const file of Object.keys(bundled.metafile.inputs)) {
  const normalized = file.replaceAll('\\', '/');
  const marker = normalized.lastIndexOf('node_modules/');
  if (marker < 0) continue;
  const tail = normalized.slice(marker + 'node_modules/'.length).split('/');
  const name = tail[0].startsWith('@') ? tail.slice(0, 2).join('/') : tail[0];
  packageDirs.add(normalized.slice(0, marker) + 'node_modules/' + name);
}
for (const directory of packageDirs) {
  const fullDirectory = path.resolve(root, directory);
  const pkg = JSON.parse(await readFile(path.join(fullDirectory, 'package.json'), 'utf8'));
  for (const name of await readdir(fullDirectory)) {
    if (/^(licen[sc]e|notice|copying)(\.|$)/i.test(name)) {
      apiFiles[`licenses/${pkg.name}/${name}`] = new Uint8Array(await readFile(path.join(fullDirectory, name)));
    }
  }
}
const apiZip = archive(apiFiles);
const codeKey = `messwise-api-${hash(apiZip).slice(0, 12)}.zip`;
await writeFile(path.join(output, codeKey), apiZip);

const templateDoc = parseDocument(await readFile(path.join(root, 'infra/template.yaml'), 'utf8'), {
  customTags: [
    { tag: '!Ref', resolve: value => ({ Ref: value }) },
    { tag: '!Sub', resolve: value => ({ 'Fn::Sub': value }) },
    { tag: '!GetAtt', resolve: value => ({ 'Fn::GetAtt': value.split('.') }) },
  ],
});
if (templateDoc.errors.length || templateDoc.warnings.length) {
  throw new Error([...templateDoc.errors, ...templateDoc.warnings].map(error => error.message).join('\n'));
}
const template = templateDoc.toJS();
template.Parameters.CodeBucket = {
  Type: 'String', Description: 'Private S3 bucket containing the API ZIP, in this same AWS Region.',
};
template.Parameters.CodeKey = {
  Type: 'String', Default: codeKey, Description: 'Exact uploaded API ZIP object key; use the new key when updating code.',
};
template.Resources.ApiFunction.Properties.CodeUri = {
  Bucket: { Ref: 'CodeBucket' }, Key: { Ref: 'CodeKey' },
};
const consoleTemplate = JSON.stringify(template, null, 2) + '\n';
await writeFile(path.join(output, 'stack-console.json'), consoleTemplate);

const webFiles = {};
async function readWebDirectory(relative = '') {
  for (const entry of await readdir(path.join(root, 'dist', relative), { withFileTypes: true })) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) await readWebDirectory(name);
    else webFiles[name] = new Uint8Array(await readFile(path.join(root, 'dist', name)));
  }
}
await readWebDirectory();
if (!webFiles['index.html']) throw new Error('Build output must contain index.html at the ZIP root.');
const webZip = archive(webFiles);
await writeFile(path.join(output, 'messwise-web.zip'), webZip);

// Load the exact upload bundle and exercise routes that need no AWS credentials.
const smokeDirectory = path.join(output, 'smoke');
await mkdir(smokeDirectory, { recursive: true });
const unpacked = unzipSync(apiZip);
await writeFile(path.join(smokeDirectory, 'index.cjs'), unpacked['index.js']);
const { handler } = createRequire(import.meta.url)(path.join(smokeDirectory, 'index.cjs'));
const noAuth = await handler({ routeKey: 'GET /health' });
const health = await handler({ routeKey: 'GET /health', requestContext: {
  requestId: 'package-smoke', authorizer: { jwt: { claims: { sub: 'package-smoke' } } },
} });
if (noAuth.statusCode !== 401 || health.statusCode !== 200) throw new Error('Packaged handler smoke check failed.');

const manifest = {
  generatedAt: new Date().toISOString(), codeKey, codeSha256: hash(apiZip),
  consoleTemplateSha256: hash(consoleTemplate), webSha256: hash(webZip),
  codeBytes: apiZip.length, webBytes: webZip.length,
  packagedHandlerSmokeCheck: 'passed', deployed: false,
  frontendNote: 'Rebuild after setting the three AWS identifiers in .env.local. This archive reflects the current build configuration.',
};
await writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`AWS console template: ${path.join(output, 'stack-console.json')}`);
console.log(`Lambda ZIP: ${path.join(output, codeKey)} (${apiZip.length} bytes)`);
console.log(`Amplify ZIP: ${path.join(output, 'messwise-web.zip')} (${webZip.length} bytes)`);
console.log('Packaged handler smoke check passed. No AWS resources were deployed.');
