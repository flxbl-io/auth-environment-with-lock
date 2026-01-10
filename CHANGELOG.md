# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
