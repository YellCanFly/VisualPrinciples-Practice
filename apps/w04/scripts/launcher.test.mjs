import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const launcherPath = resolve(projectRoot, '启动实验室.cmd');
const windowsOnly = { skip: process.platform !== 'win32', timeout: 30_000 };

async function availablePort() {
  const probe = createServer();
  await new Promise((accept, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', accept);
  });
  const { port } = probe.address();
  await new Promise((accept, reject) => probe.close(error => error ? reject(error) : accept()));
  return port;
}

function launchBatch(port) {
  // Match the actual Windows cmd entry point, including the real Chinese path.
  // Arguments are fixed switches plus a generated integer, never shell input.
  const command = `""${launcherPath}" --port ${port} --no-open"`;
  const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], {
    cwd: projectRoot,
    windowsHide: true,
    windowsVerbatimArguments: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const exited = new Promise(accept => {
    child.once('error', error => { spawnError = error; accept({ error }); });
    child.once('exit', (code, signal) => accept({ code, signal }));
  });
  return { child, exited, output: () => output, error: () => spawnError };
}

async function eventually(predicate, diagnostic, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const result = await predicate();
    if (result) return result;
    await delay(80);
  }
  throw new Error(`Launcher did not reach the expected state.\n${diagnostic()}`);
}

async function stopOwnedTree(run) {
  // Only the PID returned by this test's own spawn is eligible for termination.
  // /T also closes its Node child; unrelated servers and occupied ports stay intact.
  if (run.child.exitCode === null && run.child.signalCode === null && Number.isInteger(run.child.pid)) {
    const killer = spawn('taskkill.exe', ['/PID', String(run.child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    await new Promise(accept => { killer.once('exit', accept); killer.once('error', accept); });
  }
  run.child.stdin.destroy();
  await Promise.race([run.exited, delay(2_000)]);
}

test('Windows launcher stays open and serves the laboratory from its Chinese project path', windowsOnly, async () => {
  const port = await availablePort();
  const run = launchBatch(port);
  try {
    const html = await eventually(async () => {
      if (run.error()) throw run.error();
      if (run.child.exitCode !== null) throw new Error(`Launcher exited before serving (code ${run.child.exitCode}).\n${run.output()}`);
      try {
        const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(750) });
        if (!response.ok) return false;
        return await response.text();
      } catch { return false; }
    }, run.output);
    assert.match(html, /<title>立体感知\s*·\s*空间实验室<\/title>/u);
    assert.match(run.output(), new RegExp(`http://127\\.0\\.0\\.1:${port}/`));
    assert.equal(run.child.exitCode, null, 'The batch window must remain open while serving.');
    const again = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(750) });
    assert.equal(again.status, 200, 'The service must remain available after the initial response.');
  } finally {
    await stopOwnedTree(run);
  }
  await eventually(async () => {
    try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(300) }); return false; }
    catch { return true; }
  }, () => `Test-owned server on port ${port} was not stopped.`, 3_000);
});

test('Windows launcher preserves a startup error for reading and returns its failure code', windowsOnly, async () => {
  const run = launchBatch(0);
  try {
    await eventually(() => run.output().includes('Port must be'), run.output);
    assert.equal(run.child.exitCode, null, 'Invalid arguments must leave the diagnostic window open until acknowledged.');
    // Acknowledge the batch pause through its own redirected stdin.
    run.child.stdin.end('\r\n');
    const result = await Promise.race([run.exited, delay(5_000).then(() => null)]);
    assert.ok(result, `Launcher did not finish after acknowledgement.\n${run.output()}`);
    assert.equal(result.code, 1, `The Node failure code should survive echo/pause commands.\n${run.output()}`);
  } finally {
    await stopOwnedTree(run);
  }
});
