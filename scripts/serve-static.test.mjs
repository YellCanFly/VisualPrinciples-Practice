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
  fixture = await mkdtemp(join(tmpdir(), 'visualprinciples-server-test-'));
  await mkdir(join(fixture, 'assets'));
  await writeFile(join(fixture, 'index.html'), '<!doctype html><title>Lab</title>');
  await writeFile(join(fixture, 'assets', 'app.js'), 'console.log("local");');
  await writeFile(join(fixture, '.private'), 'not public');
  server = createStaticServer({ root: fixture, base: '/VisualPrinciples-Practice/' });
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
  const page = await get('/VisualPrinciples-Practice/');
  assert.equal(page.status, 200);
  assert.match(page.body, /<title>Lab<\/title>/);
  assert.match(page.headers['content-type'], /text\/html/);
  const js = await get('/VisualPrinciples-Practice/assets/app.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
});

test('HEAD returns metadata without a body', async () => {
  const response = await get('/VisualPrinciples-Practice/assets/app.js', 'HEAD');
  assert.equal(response.status, 200);
  assert.equal(response.body, '');
  assert.ok(Number(response.headers['content-length']) > 0);
});

test('mount redirect is explicit and missing resources are not SPA fallback', async () => {
  const redirect = await get('/VisualPrinciples-Practice');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.location, '/VisualPrinciples-Practice/');
  assert.equal((await get('/VisualPrinciples-Practice/missing.js')).status, 404);
  assert.equal((await get('/')).status, 404);
});

test('rejects mutation methods, malformed paths, hidden files, and traversal', async () => {
  assert.equal((await get('/VisualPrinciples-Practice/', 'POST')).status, 405);
  for (const path of [
    '/VisualPrinciples-Practice/%ZZ', '/VisualPrinciples-Practice/%00',
    '/VisualPrinciples-Practice/.private', '/VisualPrinciples-Practice/%2e%2e%2fsecret',
    '/VisualPrinciples-Practice/assets%5c..%5csecret', '/VisualPrinciples-Practice/C:%5csecret',
  ]) assert.ok((await get(path)).status >= 400, path);
});

test('normalizes safe mounts and refuses ambiguous mount paths', () => {
  assert.equal(normalizeBase('lab'), '/lab/');
  assert.equal(normalizeBase('/'), '/');
  for (const path of ['../lab', '/a/../b/', '/a?x/', '/a\\b/']) {
    assert.throws(() => normalizeBase(path));
  }
});

test('redirects existing nested directories and preserves query parameters', async () => {
  const response = await get('/VisualPrinciples-Practice/assets?from=course');
  assert.equal(response.status, 308);
  assert.equal(response.headers.location, '/VisualPrinciples-Practice/assets/?from=course');
});
