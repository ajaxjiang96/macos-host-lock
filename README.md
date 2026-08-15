# macOS Host Lock

[![CI](https://github.com/ajaxjiang96/macos-host-lock/actions/workflows/ci.yml/badge.svg)](https://github.com/ajaxjiang96/macos-host-lock/actions/workflows/ci.yml)

A cooperative, cross-repository mutex for GitHub Actions runner registrations
that share one physical Mac.

GitHub `concurrency` groups coordinate workflow runs inside GitHub, but they do
not serialize jobs from unrelated repositories. Separate self-hosted runner
agents on one Mac still share keychain search state, provisioning-profile
directories, Xcode caches, simulators, CPU, memory, and disk bandwidth.

## Usage

Place the lock immediately after checkout. GitHub runs post actions in reverse
registration order, so the lock remains held while later action cleanup runs.

```yaml
- uses: actions/checkout@v7

- name: Acquire shared iOS release host
  uses: ajaxjiang96/macos-host-lock@v1
  with:
    lock-name: ios-release
    timeout-seconds: '5400'
    stale-seconds: '10800'

- run: xcodebuild archive ...
```

Every cooperating workflow on the physical Mac must use the same `lock-name`.
A workflow that does not acquire the lock cannot be restrained by another
repository.

For supply-chain-sensitive workflows, pin the full release SHA instead of the
moving `v1` compatibility tag.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `lock-name` | no | `ios-release` | Shared logical resource name |
| `timeout-seconds` | no | `5400` | Maximum wait for the current owner |
| `stale-seconds` | no | `10800` | Age at which an abandoned lock can be recovered |

`stale-seconds` must be greater than `timeout-seconds` and longer than the
largest possible protected job.

## Output

`wait-seconds` reports the whole number of seconds spent waiting.
`recovered-stale-lock` is `true` when acquisition replaced an abandoned lock,
so release reports can distinguish normal queueing from stale-state recovery.

## Safety model

- Acquisition uses an atomic directory under the Mac's shared temporary
  directory.
- Owner metadata records repository, workflow, job, run, attempt, and runner.
- A random owner token prevents another run from releasing the lock.
- Stale-lock recovery renames the abandoned directory before removing it.
- A GitHub post action releases the lock after later workflow steps complete or
  fail.

This is cooperative synchronization, not a security boundary between mutually
untrusted local users. All runner agents must see the same system temporary
directory.

## License

MIT
