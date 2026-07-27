# Changelog

## 1.0.0 - 2026-07-27

- Acquire an atomic named mutex shared by runner agents and repositories on one
  physical Mac.
- Record owner metadata and protect release with a random owner token.
- Wait with a bounded timeout and recover abandoned locks after a longer stale
  threshold.
- Release automatically through a GitHub post action.
