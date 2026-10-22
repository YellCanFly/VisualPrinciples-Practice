import { existsSync } from 'node:fs';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, insideRoot, loadWeeks, npm, runNode, viteCLI } from './lib.mjs';

try {
  const action = process.argv[2];
  const weeks = loadWeeks();
  if (action === 'check') {
    for (const week of weeks) {
      for (const file of ['index.html', 'package-lock.json']) {
        if (!existsSync(resolve(root, week.directory, file))) throw new Error(`${week.directory}/${file} 不存在，请先运行 npm run setup。`);
      }
      if (week.preview && !existsSync(resolve(root, 'public', week.preview))) throw new Error(`${week.id} 预览图不存在。`);
    }
    console.log(`课程注册表检查通过：${weeks.map(w => w.id.toUpperCase()).join('、')}`);
  } else if (action === 'setup') {
    for (const dir of [root, ...weeks.map(w => resolve(root, w.directory))]) {
      console.log(`\n安装 ${dir === root ? '课程首页' : dir}`);
      await npm([existsSync(resolve(dir, 'package-lock.json')) ? 'ci' : 'install', '--no-audit', '--no-fund'], dir);
    }
  } else if (action === 'test' || action === 'typecheck') {
    if (action === 'test') await runNode(['--test', 'scripts/serve-static.test.mjs']);
    for (const week of weeks) {
      console.log(`\n${week.id.toUpperCase()} · ${action}`);
      await npm(['run', action], resolve(root, week.directory));
    }
  } else if (action === 'build') {
    await runNode([viteCLI, 'build']);
    for (const week of weeks) {
      console.log(`\n构建 ${week.id.toUpperCase()} · ${week.title}`);
      const dir = resolve(root, week.directory);
      await npm(['run', 'build'], dir);
      const target = insideRoot(resolve(root, 'dist', week.id));
      await mkdir(target, { recursive: true });
      await cp(resolve(dir, 'dist'), target, { recursive: true });
    }
    await writeFile(resolve(root, 'dist/.nojekyll'), '');
    console.log('\n全部课程已构建至 dist/。运行 npm run preview 查看。');
  } else throw new Error(`未知命令：${action}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
