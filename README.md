# Lock and Authenticate Environment Action

[![CI](https://github.com/flxbl-io/lock-environment/actions/workflows/ci.yml/badge.svg)](https://github.com/flxbl-io/lock-environment/actions/workflows/ci.yml)

A GitHub Action that locks a Salesforce environment using [SFP Server](https://docs.flxbl.io/sfp-server) and authenticates to it. Provides distributed locking to prevent concurrent access conflicts across parallel workflows.

**Automatic Unlock**: By default, this action automatically releases the environment lock when the workflow completes (success, failure, or cancellation).

## Usage

### Basic Usage

```yaml
- name: Lock and authenticate to environment
  id: lock-env
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'QA'
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

- name: Install packages
  run: sfp install -o ${{ steps.lock-env.outputs.alias }}

# No unlock step needed - automatic cleanup handles it!
```

### With Reason and Custom Duration

```yaml
- name: Lock environment for deployment
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'staging'
    reason: 'Release v1.2.3 deployment'
    duration: '120'  # 2 hours
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}
```

### Without Waiting (Fail Fast)

```yaml
- name: Lock environment (fail if busy)
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'ci-sandbox-1'
    wait: 'false'  # Fail immediately if locked by another workflow
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}
```

### Disable Auto-Unlock

```yaml
- name: Lock environment (manual unlock later)
  id: lock-env
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'QA'
    auto-unlock: 'false'
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

# Later, unlock manually using unlock-environment action
- name: Unlock environment
  uses: flxbl-io/unlock-environment@v1
  with:
    environment: 'QA'
    ticket-id: ${{ steps.lock-env.outputs.ticket-id }}
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `environment` | Name of the environment to lock | **Yes** | - |
| `sfp-server-url` | URL to SFP Server (e.g., `https://your-org.flxbl.io`) | **Yes** | - |
| `sfp-server-token` | SFP Server application token | **Yes** | - |
| `repository` | Repository name (`owner/repo` format) | No | Current repository |
| `duration` | Lock duration in minutes | No | `60` |
| `reason` | Reason for locking (shown to other workflows) | No | - |
| `wait` | Wait for lock if environment is busy | No | `true` |
| `auto-unlock` | Automatically unlock when workflow completes | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `alias` | Alias used for the authenticated org (same as environment name) |
| `ticket-id` | Lock ticket ID (needed for manual unlock if auto-unlock is disabled) |
| `instance-url` | Instance URL of the authenticated org |
| `access-token` | Access token for the org |
| `username` | Salesforce username |
| `is-active` | Whether the lock was acquired |
| `auth-method` | Authentication method (`sfp-server`) |

## Automatic Unlock Behavior

This action uses GitHub Actions' post-step feature to automatically unlock environments. The cleanup runs:

- After the job completes (success or failure)
- When the workflow is cancelled
- Even if subsequent steps in the job fail

Set `auto-unlock: 'false'` to disable this behavior and manage unlocking manually.

## How Distributed Locking Works

```
┌─────────────────────────────────────────────────────────────┐
│                  Workflow A (PR #123)                       │
│  lock-environment → QA                                      │
│  Status: LOCKED (ticket: abc-123)                           │
│  ... workflow runs ...                                      │
│  [Auto-unlock on completion]                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Workflow B (PR #124)                       │
│  lock-environment → QA                                      │
│  Status: WAITING... (wait=true)                             │
│         ↓                                                   │
│  [Workflow A completes, auto-unlocks]                       │
│         ↓                                                   │
│  Status: LOCKED (ticket: def-456)                           │
│  ... workflow runs ...                                      │
│  [Auto-unlock on completion]                                │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- SFP Server instance with environment management configured
- Environment registered in SFP Server
- `sfp` CLI available (use `sfops` Docker image)

## Example: CI/CD Pipeline

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    container: ghcr.io/flxbl-io/sfops:latest

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to DevHub
        uses: flxbl-io/auth-devhub@v1
        with:
          sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
          sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

      - name: Lock CI environment
        id: lock
        uses: flxbl-io/lock-environment@v1
        with:
          environment: 'ci-sandbox'
          reason: 'PR #${{ github.event.pull_request.number }}'
          sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
          sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

      - name: Install and validate
        run: |
          sfp install -o ${{ steps.lock.outputs.alias }}

      # Unlock happens automatically!
```

## Related Actions

- [unlock-environment](https://github.com/flxbl-io/unlock-environment) - Manual environment unlock
- [auth-environment](https://github.com/flxbl-io/auth-environment) - Authenticate without locking
- [auth-devhub](https://github.com/flxbl-io/auth-devhub) - Authenticate to DevHub

## License

Copyright 2025 flxbl-io. All rights reserved. See [LICENSE](LICENSE) for details.
