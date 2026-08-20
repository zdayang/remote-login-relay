import {spawn} from 'node:child_process';

const [secondsRaw, command, ...args] = process.argv.slice(2);
const seconds = Number(secondsRaw);
if (!Number.isInteger(seconds) || seconds < 1 || !command) {
  console.error('Usage: node run-with-timeout.mjs <seconds> <command> [args...]');
  process.exit(2);
}

const child = spawn(command, args, {stdio: 'inherit'});
const timer = setTimeout(() => child.kill('SIGTERM'), seconds * 1000);
const forward = (signal) => child.kill(signal);
process.on('SIGTERM', () => forward('SIGTERM'));
process.on('SIGINT', () => forward('SIGINT'));
child.on('exit', (code, signal) => {
  clearTimeout(timer);
  process.exitCode = code ?? (signal ? 1 : 0);
});
