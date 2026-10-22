import { resolve } from 'node:path';
import { root, loadWeeks } from './lib.mjs';
import { createStaticServer } from './serve-static.mjs';

const base = '/VisualPrinciples-Practice/';
const server = createStaticServer({root:resolve(root,'dist'),base});
try {
  await new Promise((accept,reject) => {server.once('error',reject);server.listen(0,'127.0.0.1',accept);});
  const origin = `http://127.0.0.1:${server.address().port}`;
  const checked = new Set();
  async function check(url) {
    checked.add(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    const type = response.headers.get('content-type') || '';
    if (/\.(js|css|otf|png|ply)(?:\?|$)/.test(url) && type.includes('text/html')) throw new Error(`资源错误返回 HTML: ${url}`);
    return response;
  }
  for (const page of ['', ...loadWeeks().map(w => w.path)]) {
    const url = `${origin}${base}${page}`;
    const response = await check(url);
    const html = await response.text();
    for (const [,link] of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      if (/^(https?:|#|data:)/.test(link)) continue;
      await check(new URL(link,url).href);
    }
  }
  for (const file of ['w03/fonts/sans.otf','w03/fonts/serif.otf','w04/models/stanford-bunny.ply','w04/models/suzanne.ply']) await check(`${origin}${base}${file}`);
  console.log(`生产子路径验证通过：${checked.size} 个页面、脚本、样式与资源。`);
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {server.close();}
