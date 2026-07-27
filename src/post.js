import {releaseHostLock} from './lib.js';

try {
  const lockDirectory = process.env.STATE_lock_directory;
  const token = process.env.STATE_lock_token;
  if (lockDirectory && token) {
    const released = await releaseHostLock(lockDirectory, token);
    process.stdout.write(
      released ? 'Released macOS host lock.\n' : 'Host lock was already released or replaced.\n',
    );
  }
} catch (error) {
  process.stderr.write(`::warning::Host lock cleanup failed: ${error.message}\n`);
}
