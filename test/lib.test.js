import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {
  acquireHostLock,
  positiveInteger,
  releaseHostLock,
  safeLockName,
} from '../src/lib.js';

test('validates lock inputs', () => {
  assert.equal(safeLockName('ios-release'), 'ios-release');
  assert.equal(positiveInteger('5400', 'timeout'), 5400);
  assert.throws(() => safeLockName('../escape'), /lock-name/);
  assert.throws(() => positiveInteger('0', 'timeout'), /positive integer/);
});

test('serializes owners and only lets the owner release', async () => {
  const root = await mkdtemp(join(tmpdir(), 'macos-host-lock-test-'));
  try {
    const first = await acquireHostLock({
      root,
      name: 'ios-release',
      token: 'first',
      owner: {runId: '1'},
      timeoutMs: 100,
      staleMs: 1000,
    });
    await assert.rejects(
      acquireHostLock({
        root,
        name: 'ios-release',
        token: 'second',
        owner: {runId: '2'},
        timeoutMs: 1,
        staleMs: 1000,
        pollMs: 1,
        wait: async () => {},
      }),
      /Timed out/,
    );
    assert.equal(await releaseHostLock(first.lockDirectory, 'second'), false);
    assert.equal(await releaseHostLock(first.lockDirectory, 'first'), true);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
