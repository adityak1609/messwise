import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { aws, region, workspace } from './aws-session.mjs';

const artifact = name => path.join(workspace, '.artifacts', 'aws', name);
const stateFile = artifact('deployment-state.json');
const manifest = JSON.parse(await readFile(artifact('manifest.json'), 'utf8'));
const codeFile = artifact(manifest.codeKey);
const code = await readFile(codeFile);
if (createHash('sha256').update(code).digest('hex') !== manifest.codeSha256) throw new Error('API package differs from the verified build. Run npm run package:aws.');
const identity = await aws(['sts', 'get-caller-identity']);
console.log(`Verified deployment account ${identity.Account}, region ${region}.`);
let state;
try { state = JSON.parse(await readFile(stateFile, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
if (state && (state.account !== identity.Account || state.region !== region)) throw new Error('Saved deployment belongs to another account or region. Refusing to change it.');
state ??= { account: identity.Account, region, stackName: 'messwise-pilot', codeBucket: `messwise-code-${identity.Account}-${region}`, branch: 'pilot' };
const save = () => writeFile(stateFile, JSON.stringify(state, null, 2) + '\n');

console.log('Preparing the private API code bucket.');
let existingBucket = false;
try { await aws(['s3api', 'head-bucket', '--bucket', state.codeBucket, '--expected-bucket-owner', identity.Account]); existingBucket = true; }
catch (error) { if (!/\(404\)|Not Found/.test(error.message)) throw error; }
if (existingBucket) {
  const tags = await aws(['s3api', 'get-bucket-tagging', '--bucket', state.codeBucket, '--expected-bucket-owner', identity.Account]);
  if (!tags.TagSet.some(tag => tag.Key === 'Project' && tag.Value === 'MessWise')) throw new Error('Existing code bucket is not marked as this project. Refusing to modify it.');
} else {
  try {
    await aws(['s3api', 'create-bucket', '--bucket', state.codeBucket, ...(region === 'us-east-1' ? [] : ['--create-bucket-configuration', `LocationConstraint=${region}`])]);
  } catch (error) {
    if (/NotSignedUp/.test(error.message)) throw new Error('AWS sign-in succeeded, but S3 is not enabled for this account yet. No code bucket was created. Complete any requested account setup in the AWS console and wait for activation, then rerun this deployment. Keep the Free plan; this error alone does not require a plan upgrade.');
    throw error;
  }
  await aws(['s3api', 'put-bucket-tagging', '--bucket', state.codeBucket, '--tagging', 'TagSet=[{Key=Project,Value=MessWise}]']);
}
await aws(['s3api', 'put-public-access-block', '--bucket', state.codeBucket, '--expected-bucket-owner', identity.Account, '--public-access-block-configuration', 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true']);
await aws(['s3api', 'put-bucket-encryption', '--bucket', state.codeBucket, '--expected-bucket-owner', identity.Account, '--server-side-encryption-configuration', '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}']);
await aws(['s3api', 'put-object', '--bucket', state.codeBucket, '--key', manifest.codeKey, '--body', codeFile, '--server-side-encryption', 'AES256', '--expected-bucket-owner', identity.Account, '--metadata', `sha256=${manifest.codeSha256}`]);
await save();

let existingStack;
try { existingStack = (await aws(['cloudformation', 'describe-stacks', '--stack-name', state.stackName])).Stacks[0]; }
catch (error) { if (!/does not exist/.test(error.message)) throw error; }
if (existingStack && !existingStack.Tags?.some(tag => tag.Key === 'Project' && tag.Value === 'MessWise')) throw new Error('Existing stack is not marked as this project. Refusing to overwrite it.');
const deploy = async origin => aws(['cloudformation', 'deploy', '--template-file', artifact('stack-console.json'), '--stack-name', state.stackName, '--parameter-overrides', `CodeBucket=${state.codeBucket}`, `CodeKey=${manifest.codeKey}`, `AllowedOrigin=${origin}`, 'EnablePlateScoring=true', 'BedrockRegion=us-east-1', '--capabilities', 'CAPABILITY_IAM', '--tags', 'Project=MessWise', '--no-fail-on-empty-changeset'], { raw: true, progress: true });
console.log('Deploying API, private storage, Cognito, and the Bedrock permission.');
try { await deploy(state.url || 'http://127.0.0.1:5173'); }
catch (error) {
  const events = await aws(['cloudformation', 'describe-stack-events', '--stack-name', state.stackName]);
  console.error(JSON.stringify(events.StackEvents.filter(event => event.ResourceStatus.endsWith('FAILED')).map(event => ({ resource: event.LogicalResourceId, reason: event.ResourceStatusReason })), null, 2));
  throw error;
}
const stack = (await aws(['cloudformation', 'describe-stacks', '--stack-name', state.stackName])).Stacks[0];
state.outputs = Object.fromEntries(stack.Outputs.map(output => [output.OutputKey, output.OutputValue]));
await save();
const envFile = path.join(workspace, '.env.local');
let envContent = '';
try { envContent = await readFile(envFile, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
for (const [key, value] of Object.entries({ VITE_API_URL: state.outputs.ApiUrl, VITE_COGNITO_CLIENT_ID: state.outputs.ClientId, VITE_AWS_REGION: region })) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  envContent = pattern.test(envContent) ? envContent.replace(pattern, line) : envContent.trimEnd() + '\n' + line + '\n';
}
await writeFile(envFile, envContent.trimStart());
console.log('Building the frontend with the deployed app identifiers.');
await new Promise((resolve, reject) => {
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const child = spawn(process.execPath, [npmCli, 'run', 'package:aws'], { cwd: workspace, stdio: 'inherit', windowsHide: true });
  child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('Configured frontend build failed.')));
});

console.log('Preparing Amplify hosting.');
if (!state.appId) {
  const created = await aws(['amplify', 'create-app', '--name', 'messwise', '--platform', 'WEB', '--description', 'MessWise environmental hackathon pilot', '--tags', 'Project=MessWise', '--no-enable-branch-auto-build']);
  state.appId = created.app.appId; state.domain = created.app.defaultDomain; await save();
} else {
  const current = (await aws(['amplify', 'get-app', '--app-id', state.appId])).app;
  if (current.tags?.Project !== 'MessWise') throw new Error('Saved Amplify app is not marked as this project.');
  state.domain = current.defaultDomain;
}
try { await aws(['amplify', 'get-branch', '--app-id', state.appId, '--branch-name', state.branch]); }
catch (error) {
  if (!/NotFoundException|does not exist/.test(error.message)) throw error;
  await aws(['amplify', 'create-branch', '--app-id', state.appId, '--branch-name', state.branch, '--stage', 'PRODUCTION', '--no-enable-auto-build']);
}
const deployment = await aws(['amplify', 'create-deployment', '--app-id', state.appId, '--branch-name', state.branch]);
// The upload URL is a temporary credential. Keep it in memory and out of logs.
const upload = await fetch(deployment.zipUploadUrl, { method: 'PUT', body: await readFile(artifact('messwise-web.zip')), headers: { 'content-type': 'application/zip' } });
if (!upload.ok) throw new Error(`Amplify archive upload failed (${upload.status}).`);
await aws(['amplify', 'start-deployment', '--app-id', state.appId, '--branch-name', state.branch, '--job-id', deployment.jobId]);
state.jobId = deployment.jobId; state.url = `https://${state.branch}.${state.domain}`; await save();
console.log(`Amplify deployment started: ${state.url}`);
for (let attempt = 0; attempt < 120; attempt++) {
  const job = (await aws(['amplify', 'get-job', '--app-id', state.appId, '--branch-name', state.branch, '--job-id', state.jobId])).job;
  if (job.summary.status === 'SUCCEED') break;
  if (['FAILED', 'CANCELLED'].includes(job.summary.status)) throw new Error(`Amplify deployment ${job.summary.status}. Check job ${state.jobId}.`);
  if (attempt === 119) throw new Error('Amplify deployment is still pending. No resources were deleted.');
  if (attempt % 6 === 0) console.log(`Hosting status: ${job.summary.status}`);
  await new Promise(resolve => setTimeout(resolve, 5000));
}
console.log('Setting API and photo CORS to the hosted origin.');
await deploy(state.url);
const page = await fetch(state.url);
if (!page.ok || !(await page.text()).includes('MessWise')) throw new Error(`Hosted app check failed (${page.status}).`);
state.deployedAt = new Date().toISOString(); state.hostCheck = 'passed'; await save();
console.log(`MessWise hosted successfully: ${state.url}`);
console.log('App sign-in and a real paired-photo scoring test still need a pilot user and photos.');
