import { spawn, spawnSync } from 'node:child_process';

// Run only in the user's interactive terminal. The authorization code goes
// straight to AWS CLI stdin; it is never captured by this helper.
const [cli, region] = process.argv.slice(2);
if (!cli || !region) throw new Error('Expected the AWS CLI path and sign-in region.');

const child = spawn(cli, ['login', '--remote', '--profile', 'messwise', '--region', region, '--no-cli-pager', '--color', 'off'], {
  stdio: ['inherit', 'pipe', 'inherit'],
  env: { ...process.env, PYTHONUNBUFFERED: '1' },
});
let pending = '';
let copied = false;

child.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  if (copied) return;
  pending += chunk.toString();
  // Wait for a complete line so a split output chunk cannot truncate the URL.
  const lines = pending.split(/\r?\n/);
  pending = lines.pop();
  for (const line of lines) {
    const match = line.match(/https:\/\/[^\s]+/);
    if (!match) continue;
    const url = new URL(match[0]);
    if (url.hostname !== `${region}.signin.aws.amazon.com` || url.pathname !== '/v1/authorize') continue;
    if (!url.searchParams.get('state') || !url.searchParams.get('code_challenge')) continue;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Set-Clipboard -Value ([Console]::In.ReadToEnd())'], {
      input: url.href,
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true,
      timeout: 10000,
    });
    copied = true;
    if (result.status === 0) {
      process.stdout.write('\nThe COMPLETE fresh AWS link is now on your clipboard.\nOpen a NEW Incognito/InPrivate window (Ctrl+Shift+N), then paste it into the address bar (Ctrl+V).\nSign in to the AWS account used for MessWise. Paste the resulting authorization code into THIS terminal.\n');
    } else {
      process.stdout.write('\nAutomatic clipboard copy failed. Copy the entire URL above into a new private browser window.\n');
    }
  }
});
child.once('error', error => {
  console.error(`Could not start AWS CLI: ${error.message}`);
  process.exitCode = 1;
});
child.once('close', code => { process.exitCode = code ?? 1; });
