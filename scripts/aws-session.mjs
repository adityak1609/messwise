import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const region = process.env.MESSWISE_REGION || 'us-east-1';
const cli = process.env.MESSWISE_AWS_CLI || path.join(workspace, '.tools', 'awscli', 'portable', 'Amazon', 'AWSCLIV2', 'aws.exe');
const session = path.join(workspace, '.tools', 'aws-session');
const environment = { ...process.env, AWS_CONFIG_FILE: path.join(session, 'config'), AWS_SHARED_CREDENTIALS_FILE: path.join(session, 'credentials'), AWS_LOGIN_CACHE_DIRECTORY: path.join(session, 'login-cache'), AWS_PROFILE: 'messwise', AWS_PAGER: '', AWS_CLI_AUTO_PROMPT: 'off', AWS_EC2_METADATA_DISABLED: 'true' };
for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_ENDPOINT_URL']) delete environment[key];

/** Use the event's temporary profile without printing credentials or signed URLs. */
export async function aws(args, { raw = false, progress = false } = {}) {
  const output = await new Promise((resolve, reject) => {
    const child = spawn(cli, [...args, '--profile', 'messwise', '--region', region, '--output', 'json', '--no-cli-pager', '--color', 'off'], { cwd: workspace, env: environment, windowsHide: true });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; if (progress) process.stdout.write(data); });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`AWS ${args[0]} ${args[1]} failed: ${stderr.trim() || stdout.trim()}`)));
  });
  return raw || !output ? output : JSON.parse(output);
}
