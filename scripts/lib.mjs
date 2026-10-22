import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function insideRoot(path) {
  const rel = relative(root, resolve(path));
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`路径超出总工程：${path}`);
  return resolve(path);
}
export function loadWeeks() {
  const weeks = JSON.parse(readFileSync(resolve(root, 'config/weeks.json'), 'utf8'));
  if (!Array.isArray(weeks) || weeks.length === 0) throw new Error('课程注册表必须包含至少一周。');
  const ids = new Set(), ports = new Set([5173, 4173]);
  for (const week of weeks) {
    if (!/^w\d{2,3}$/.test(week.id) || ids.has(week.id)) throw new Error(`周编号无效或重复：${week.id}`);
    if (week.directory !== `apps/${week.id}` || week.path !== `${week.id}/`) throw new Error(`目录与周编号不一致：${week.id}`);
    if (!Number.isInteger(week.port) || week.port < 1024 || week.port > 65535 || ports.has(week.port)) throw new Error(`开发端口无效或重复：${week.port}`);
    if (!week.title || !week.description || !Array.isArray(week.tags)) throw new Error(`${week.id} 缺少课程介绍。`);
    if (!existsSync(resolve(root, week.directory, 'package.json'))) throw new Error(`${week.directory}/package.json 不存在。`);
    ids.add(week.id); ports.add(week.port);
  }
  return weeks;
}
export function runNode(args, cwd = root) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? accept() : reject(new Error(`命令失败 (${code ?? signal}): node ${args.join(' ')}`)));
  });
}
export function npm(args, cwd = root) {
  const cli = process.env.npm_execpath || resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!existsSync(cli)) throw new Error('请通过 npm run 执行课程命令。');
  return runNode([cli, ...args], cwd);
}
export const viteCLI = resolve(root, 'node_modules/vite/bin/vite.js');
