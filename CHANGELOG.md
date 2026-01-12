# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-01-12)


### Features

* add manual trigger to CI workflow ([98053b4](https://github.com/flxbl-io/auth-environment-with-lock/commit/98053b438d306068530908572c9cfe294f952e4b))
* always wait for lock, add wait-timeout option ([8fa387f](https://github.com/flxbl-io/auth-environment-with-lock/commit/8fa387f1aefb5c11a69a90d0b9d26c68d31463c6))
* initial release of lock-environment action ([51cc303](https://github.com/flxbl-io/auth-environment-with-lock/commit/51cc3038bb618a130a3bfeacc5799d05d97b253d))
* rename to auth-environment-with-lock ([6b19f63](https://github.com/flxbl-io/auth-environment-with-lock/commit/6b19f636e2731fc6c7db4d2d5068597309151822))


### Bug Fixes

* shorten descriptions to meet 125 char limit ([afa6381](https://github.com/flxbl-io/auth-environment-with-lock/commit/afa63818406814d68558c4e4717fa8f403cfd368))
* use correct sfp server environment lock/unlock commands with explicit args ([005f235](https://github.com/flxbl-io/auth-environment-with-lock/commit/005f235d369f38fa36ce2892b667643a9a87535f))
* use GHA_TOKEN for release-please ([c27065a](https://github.com/flxbl-io/auth-environment-with-lock/commit/c27065a9883d473aa947e31831b85dda81936c51))

## [Unreleased]

## [1.0.0] - 2025-01-10

### Added

- Initial release as standalone Marketplace action
- Lock environments via SFP Server with distributed locking
- Automatic authentication after acquiring lock
- Fallback to server-sandbox or server-scratch login
- Rich output including ticket ID for unlocking
- Aligned header with sfp-pro CLI style

### Features

- **Distributed Locking**: Safe concurrent access across parallel workflows
- **Wait Option**: Optionally wait if environment is already locked
- **Fallback Auth**: Sandbox and scratch org fallback authentication
- **Lock Ticket**: Returns ticket ID for use with unlock-environment
- **Detailed Outputs**: org-id, username, instance-url, access-token, is-active

[Unreleased]: https://github.com/flxbl-io/lock-environment/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/flxbl-io/lock-environment/releases/tag/v1.0.0
