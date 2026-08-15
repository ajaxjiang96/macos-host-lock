import {appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {
  acquireHostLock,
  actionInput,
  positiveInteger,
  safeLockName,
} from './lib.js';

function appendCommand(file, name, value) {
  appendFileSync(file, `${name}=${value}\n`, 'utf8');
}

async function main() {
  if (process.platform !== 'darwin') {
    throw new Error('macos-host-lock requires a macOS runner.');
  }
  if (!process.env.GITHUB_OUTPUT || !process.env.GITHUB_STATE) {
    throw new Error('This action must run inside GitHub Actions.');
  }

  const name = safeLockName(actionInput('lock-name') || 'ios-release');
  const timeoutSeconds = positiveInteger(
    actionInput('timeout-seconds') || '5400',
    'timeout-seconds',
  );
  const staleSeconds = positiveInteger(
    actionInput('stale-seconds') || '10800',
    'stale-seconds',
  );
  if (staleSeconds <= timeoutSeconds) {
    throw new Error('stale-seconds must be greater than timeout-seconds.');
  }

  const token = randomUUID();
  const result = await acquireHostLock({
    root: join(tmpdir(), 'github-actions-host-locks'),
    name,
    token,
    timeoutMs: timeoutSeconds * 1000,
    staleMs: staleSeconds * 1000,
    owner: {
      repository: process.env.GITHUB_REPOSITORY,
      workflow: process.env.GITHUB_WORKFLOW,
      job: process.env.GITHUB_JOB,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      runnerName: process.env.RUNNER_NAME,
    },
  });

  appendCommand(process.env.GITHUB_STATE, 'lock_directory', result.lockDirectory);
  appendCommand(process.env.GITHUB_STATE, 'lock_token', token);
  appendCommand(
    process.env.GITHUB_OUTPUT,
    'wait-seconds',
    Math.floor(result.waitedMs / 1000),
  );
  appendCommand(
    process.env.GITHUB_OUTPUT,
    'recovered-stale-lock',
    result.recoveredStaleLock,
  );
  if (result.recoveredStaleLock) {
    process.stdout.write('::warning::Recovered an abandoned stale host lock.\n');
  }
  process.stdout.write(`Acquired macOS host lock "${name}".\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(`::error::${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
