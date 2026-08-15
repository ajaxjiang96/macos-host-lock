import {mkdir, readFile, rename, rm, stat, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

export function actionInput(name, env = process.env) {
  return env[`INPUT_${name.replaceAll(' ', '_').toUpperCase()}`]?.trim();
}

export function positiveInteger(value, name) {
  if (!/^[1-9]\d*$/.test(value ?? '')) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return Number(value);
}

export function safeLockName(name) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) {
    throw new Error(
      'lock-name must be 1-64 characters using letters, numbers, dot, underscore, or hyphen.',
    );
  }
  return name;
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    if (error?.code === 'EPERM') return true;
    throw error;
  }
}

export async function acquireHostLock({
  root,
  name,
  token,
  owner,
  timeoutMs,
  staleMs,
  pollMs = 2000,
  now = () => Date.now(),
  wait = sleep,
  isProcessAlive = processIsAlive,
}) {
  await mkdir(root, {recursive: true, mode: 0o700});
  const lockDirectory = join(root, `${safeLockName(name)}.lock`);
  const startedAt = now();
  let recoveredStaleLock = false;

  for (;;) {
    try {
      await mkdir(lockDirectory, {mode: 0o700});
      await writeFile(
        join(lockDirectory, 'owner.json'),
        `${JSON.stringify({...owner, token, acquiredAt: new Date(now()).toISOString()}, null, 2)}\n`,
        {encoding: 'utf8', mode: 0o600, flag: 'wx'},
      );
      return {lockDirectory, waitedMs: now() - startedAt, recoveredStaleLock};
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }

    let lockStat;
    try {
      lockStat = await stat(lockDirectory);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    let ownerProcessIsDead = false;
    try {
      const currentOwner = JSON.parse(
        await readFile(join(lockDirectory, 'owner.json'), 'utf8'),
      );
      ownerProcessIsDead = Number.isSafeInteger(currentOwner.pid) && !isProcessAlive(currentOwner.pid);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      if (!(error instanceof SyntaxError)) throw error;
    }

    if (ownerProcessIsDead || now() - lockStat.mtimeMs > staleMs) {
      const abandoned = `${lockDirectory}.stale-${randomUUID()}`;
      try {
        await rename(lockDirectory, abandoned);
        await rm(abandoned, {recursive: true, force: true});
        recoveredStaleLock = true;
        continue;
      } catch (error) {
        if (!['ENOENT', 'EEXIST'].includes(error?.code)) throw error;
      }
    }

    if (now() - startedAt >= timeoutMs) {
      let currentOwner = 'unknown owner';
      try {
        currentOwner = await readFile(join(lockDirectory, 'owner.json'), 'utf8');
      } catch {
        // The owner may be between atomic directory creation and metadata write.
      }
      throw new Error(`Timed out waiting for ${name} host lock. Owner: ${currentOwner}`);
    }
    await wait(pollMs);
  }
}
export async function releaseHostLock(lockDirectory, token) {
  try {
    const owner = JSON.parse(
      await readFile(join(lockDirectory, 'owner.json'), 'utf8'),
    );
    if (owner.token !== token) return false;
    await rm(lockDirectory, {recursive: true, force: true});
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}
