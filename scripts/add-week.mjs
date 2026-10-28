import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, loadWeeks } from './lib.mjs';

try {
  const [id, title] = process.argv.slice(2);
  if (!/^w\d{2,3}$/.test(id || '') || !title?.trim()) throw new Error('用法：npm run add-week -- w05 "新的课程主题"');
  const weeks = loadWeeks();
  const dir = resolve(root, 'apps', id);
  if (weeks.some(w => w.id === id) || existsSync(dir)) throw new Error(`${id} 已存在；为保护已有内容，未作修改。`);
  let port = 5210 + Number(id.slice(1));
  while ([5173, 4173, ...weeks.map(w => w.port)].includes(port)) port++;
  const name = title.trim();
  const escaped = name.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const files = {
    'package.json': JSON.stringify({ name: `visualprinciples-${id}`, version: '0.1.0', private: true, type: 'module', engines: {node: '>=22.14.0'}, scripts: {dev:'vite --host 127.0.0.1',build:'tsc --noEmit && vite build',typecheck:'tsc --noEmit',test:'node --test'}, dependencies: {react:'19.3.1','react-dom':'19.3.1'}, devDependencies:{'@types/react':'^19.2.0','@types/react-dom':'^19.2.0','@vitejs/plugin-react':'^4.7.0',typescript:'~5.9.3',vite:'6.4.5'} }, null, 2) + '\n',
    'index.html': `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaped} · 视觉原理</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`,
    'vite.config.ts': "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({base:'./', plugins:[react()]});\n",
    'tsconfig.json': JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM','DOM.Iterable'],types:['vite/client'],module:'ESNext',moduleResolution:'Bundler',jsx:'react-jsx',strict:true,skipLibCheck:true,noEmit:true,allowImportingTsExtensions:true,esModuleInterop:true},include:['src']},null,2)+'\n',
    'src/main.tsx': `import { StrictMode } from 'react';\nimport { createRoot } from 'react-dom/client';\nimport './style.css';\nconst title = ${JSON.stringify(name)};\ncreateRoot(document.getElementById('root')!).render(<StrictMode><main><a href="../">← 课程首页</a><p>第 ${Number(id.slice(1))} 周 · 视觉原理</p><h1>{title}</h1></main></StrictMode>);\n`,
    'src/style.css': 'body{margin:0;background:#f6f5ef;color:#1e302b;font:16px/1.7 system-ui,sans-serif}main{max-width:960px;margin:0 auto;padding:48px 24px}a{color:#1b6655}h1{font-size:clamp(32px,6vw,64px)}\n',
    'README.md': `# ${name}\n\n本周属于 VisualPrinciples-Practice 总工程。在总工程根目录运行 npm run setup、npm run dev、npm run build。页面地址为 ${id}/。资源放在 public/，使用 import.meta.env.BASE_URL 引用。详细说明见 ../../docs/ADDING_A_WEEK.md。\n`,
  };
  for (const [file, content] of Object.entries(files)) {
    const target = resolve(dir, file);
    await mkdir(resolve(target, '..'), {recursive:true});
    await writeFile(target, content, 'utf8');
  }
  weeks.push({id, number:id.slice(1),title:name,description:'本周实验内容待补充。',tags:['交互实验'],path:`${id}/`,directory:`apps/${id}`,port,preview:''});
  weeks.sort((a,b) => Number(a.id.slice(1))-Number(b.id.slice(1)));
  await writeFile(resolve(root, 'config/weeks.json'), JSON.stringify(weeks,null,2)+'\n');
  console.log(`已创建 ${id} 并加入课程首页。运行 npm run setup 安装本周依赖，然后运行 npm run dev。`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
