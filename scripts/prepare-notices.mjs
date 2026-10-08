import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  ['react', 'LICENSE'], ['react-dom', 'LICENSE'],
  ['scheduler', 'LICENSE'], ['lucide-react', 'LICENSE'],
];
let notices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
for (const [name, file] of packages) {
  notices += `\n\n----- ${name} -----\n\n`;
  notices += await readFile(path.join(root, 'node_modules', name, file), 'utf8');
}
await writeFile(path.join(root, 'public', 'third-party-notices.txt'), notices);
