import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, unlink, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { request } from 'node:http';
import { createStaticServer, normalizeBase } from './serve-static.mjs';

let fixture;
let server;
let port;

before(async () => {
  fixture = await mkdtemp(join(tmpdir(), 'stereo-lab-server-test-'));
  await mkdir(join(fixture, 'assets'));
  await writeFile(join(fixture, 'index.html'), '<!doctype html><title>Lab</title>');
  await writeFile(join(fixture, 'assets', 'app.js'), 'console.log("local");');
  await writeFile(join(fixture, '.private'), 'not public');
  server = createStaticServer({ root: fixture, base: '/stereo-perception-lab/' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (fixture) {
    await unlink(join(fixture, 'index.html'));
    await unlink(join(fixture, 'assets', 'app.js'));
    await unlink(join(fixture, '.private'));
    await rmdir(join(fixture, 'assets'));
    await rmdir(fixture);
  }
});

function get(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path, method }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves subpath index and relative JS with correct MIME', async () => {
  const page = await get('/stereo-perception-lab/');
  assert.equal(page.status, 200);
  assert.match(page.body, /<title>Lab<\/title>/);
  assert.match(page.headers['content-type'], /text\/html/);
  const js = await get('/stereo-perception-lab/assets/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
});

test('HEAD returns metadata without a body', async () => {
  const response = await get('/stereo-perception-lab/assets/app.js', 'HEAD');
  assert.equal(response.status, 200);
  assert.equal(response.body, '');
  assert.ok(Number(response.headers['content-length']) > 0);
});

test('mount redirect is explicit and missing resources are not SPA fallback', async () => {
  const redirect = await get('/stereo-perception-lab');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/stereo-perception-lab/');
  assert.equal((await get('/stereo-perception-lab/missing.js')).status, 404);
  assert.equal((await get('/')).status, 404);
});

test('rejects mutation methods, malformed paths, hidden files, and traversal', async () => {
  assert.equal((await get('/stereo-perception-lab/', 'POST')).status, 405);
  for (const path of [
    '/stereo-perception-lab/%ZZ', '/stereo-perception-lab/%00',
    '/stereo-perception-lab/.private', '/stereo-perception-lab/%2e%2e%2fsecret',
    '/stereo-perception-lab/assets%5c..%5csecret', '/stereo-perception-lab/C:%5csecret',
  ]) assert.ok((await get(path)).status >= 400, path);
});

test('normalizes safe mounts and refuses ambiguous mount paths', () => {
  assert.equal(normalizeBase('lab'), '/lab/');
  assert.equal(normalizeBase('/'), '/');
  for (const path of ['../lab', '/a/../b/', '/a?x/', '/a\\b/']) {
    assert.throws(() => normalizeBase(path));
  }
});
