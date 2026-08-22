import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';

const [secondsRaw, cloudflared, portRaw, urlFile] = process.argv.slice(2);
const seconds = Number(secondsRaw);
const port = Number(portRaw);
if (!Number.isInteger(seconds) || seconds < 1 || !cloudflared || !Number.isInteger(port) || !urlFile) {
  console.error('Usage: node run-quick-tunnel.mjs <seconds> <cloudflared> <port> <url-file>');
  process.exit(2);
}

const child = spawn(cloudflared, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`], {stdio: ['ignore', 'pipe', 'pipe']});
let found = false;
const consume = async (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  if (found) return;
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  if (match) {
    found = true;
    await writeFile(urlFile, `${match[0]}\n`, {mode: 0o600});
  }
};
child.stdout.on('data', (chunk) => { consume(chunk).catch((error) => console.error(error.message)); });
child.stderr.on('data', (chunk) => { consume(chunk).catch((error) => console.error(error.message)); });

const timer = setTimeout(() => child.kill('SIGTERM'), seconds * 1000);
const stop = (signal) => child.kill(signal);
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
child.on('exit', (code, signal) => {
  clearTimeout(timer);
  process.exitCode = code ?? (signal ? 1 : 0);
});
