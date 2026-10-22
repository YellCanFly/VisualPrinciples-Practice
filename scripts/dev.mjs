import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { root, loadWeeks, viteCLI } from './lib.mjs';

const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
async function checkPort(port) {
  await new Promise((accept, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`端口 ${port} 已被占用，请先关闭占用的服务。`)));
    server.listen(port, '127.0.0.1', () => server.close(accept));
  });
}
function launch(cli, args, cwd) {
  const child = spawn(process.execPath, [cli, ...args], { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(error.message); stop(1); });
  child.once('exit', code => { if (!stopping) stop(code || 1); });
}
async function ready(url) {
  for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
    try { if ((await fetch(url)).ok) return; } catch {}
    await new Promise(accept => setTimeout(accept, 200));
  }
  throw new Error(`开发服务未就绪：${url}`);
}
try {
  const weeks = loadWeeks();
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--port')) throw new Error('用法：npm run dev -- --port 5180');
  const port = Number(args[1] || process.env.COURSE_PORT || 5173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || weeks.some(w => w.port === port)) throw new Error('首页端口无效或与课程端口重复。');
  process.env.COURSE_PORT = String(port);
  for (const cli of [viteCLI, ...weeks.map(w => resolve(root, w.directory, 'node_modules/vite/bin/vite.js'))]) {
    if (!existsSync(cli)) throw new Error('依赖尚未安装，请先运行 npm run setup。');
  }
  for (const candidate of [port, ...weeks.map(w => w.port)]) await checkPort(candidate);
  for (const week of weeks) {
    const dir = resolve(root, week.directory);
    launch(resolve(dir, 'node_modules/vite/bin/vite.js'), ['--host', '127.0.0.1', '--port', String(week.port), '--strictPort', '--base', `/${week.path}`], dir);
  }
  await Promise.all(weeks.map(w => ready(`http://127.0.0.1:${w.port}/${w.path}`)));
  launch(viteCLI, [], root);
  await ready(`http://127.0.0.1:${port}/`);
  console.log(`\n视觉原理课程首页：http://127.0.0.1:${port}/\n按 Ctrl+C 关闭全部课程开发服务。`);
} catch (error) { console.error(error.message); stop(1); }
