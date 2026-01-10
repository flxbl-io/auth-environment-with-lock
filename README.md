# Lock and Authenticate Environment Action

[![CI](https://github.com/flxbl-io/lock-environment/actions/workflows/ci.yml/badge.svg)](https://github.com/flxbl-io/lock-environment/actions/workflows/ci.yml)

A GitHub Action that locks a Salesforce environment using [SFP Server](https://docs.flxbl.io/sfp-server) and authenticates to it. Provides distributed locking to prevent concurrent access conflicts across parallel workflows.

**Automatic Unlock**: This action automatically releases the environment lock when the workflow completes (success, failure, or cancellation) - no manual unlock step required!

## Usage

### Basic Usage

```yaml
- name: Lock and authenticate to environment
  id: lock-env
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'ci-sandbox-1'
    reason: 'PR #${{ github.event.pull_request.number }} validation'
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

- name: Deploy to environment
  run: |
    sfp deploy -u ${{ steps.lock-env.outputs.alias }}

# No unlock step needed - automatic cleanup handles it!
```

### With Custom Duration

```yaml
- name: Lock environment for extended operation
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'staging'
    reason: 'Release deployment'
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
    reason: 'Quick validation'
    wait: 'false'  # Fail immediately if locked
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `environment` | Name of the environment to lock | Yes | - |
| `reason` | Reason for locking (shown to other workflows) | Yes | - |
| `sfp-server-url` | URL to SFP Server (e.g., `https://your-org.flxbl.io`) | Yes | - |
| `sfp-server-token` | SFP Server application token | Yes | - |
| `repository` | Repository name (`owner/repo` format) | No | Current repository |
| `duration` | Lock duration in minutes | No | `60` |
| `wait` | Wait for lock if environment is busy | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `alias` | Alias used for the authenticated org |
| `ticket-id` | Lock ticket ID (used internally for automatic unlock) |
| `is-active` | Whether the environment is active |
| `org-id` | Org ID of the authenticated org |
| `username` | Username of the authenticated user |
| `instance-url` | Instance URL of the org |
| `login-url` | Login URL for the org |
| `access-token` | Access token (use with caution) |
| `auth-method` | Method used: `sfp-server`, `server-sandbox`, or `server-scratch` |

## Automatic Unlock Behavior

This action uses GitHub Actions' post-step feature to automatically unlock environments. The cleanup runs:

- After the job completes (success or failure)
- When the workflow is cancelled
- Even if subsequent steps in the job fail

```
┌─────────────────────────────────────────────────────────────┐
│                    Workflow Execution                        │
├─────────────────────────────────────────────────────────────┤
│  1. lock-environment (main)                                  │
│     └── Locks environment, saves ticket ID to state          │
│                                                              │
│  2. Your deployment/test steps...                            │
│     └── Use the locked environment                           │
│                                                              │
│  3. lock-environment (post) - AUTOMATIC                      │
│     └── Unlocks environment using saved ticket ID            │
│         Runs even if step 2 fails!                           │
└─────────────────────────────────────────────────────────────┘
```

### State Management

The action uses `@actions/core` saveState/getState to persist the ticket ID and credentials between the main action and the post cleanup step:

- `ticket_id` - The lock ticket for unlocking
- `environment` - Environment name
- `repository` - Repository identifier
- `sfp_server_url` - SFP Server URL
- `sfp_server_token` - SFP Server token

### When Cleanup is Skipped

The cleanup step is skipped when:
- No lock was acquired (fallback auth was used)
- The ticket ID is empty
- Required state is missing

## How Distributed Locking Works

```
┌─────────────────────────────────────────────────────────────┐
│                  Workflow A (PR #123)                       │
│  lock-environment → ci-sandbox-1                            │
│  Status: LOCKED (ticket: abc-123)                           │
│  ... workflow runs ...                                      │
│  [Auto-unlock on completion]                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Workflow B (PR #124)                       │
│  lock-environment → ci-sandbox-1                            │
│  Status: WAITING... (wait=true)                             │
│         ↓                                                   │
│  [Workflow A completes, auto-unlocks]                       │
│         ↓                                                   │
│  Status: LOCKED (ticket: def-456)                           │
│  ... workflow runs ...                                      │
│  [Auto-unlock on completion]                                │
└─────────────────────────────────────────────────────────────┘
```

## Fallback Authentication

When the environment is not found in SFP Server's environment registry, the action attempts fallback authentication:

1. **Scratch Org**: If environment name contains `@`, tries `sfp server scratch login`
2. **Sandbox**: Otherwise, tries `sfp server sandbox login`

This enables authentication to environments managed outside the formal environment registry. Note: Fallback authentication does not acquire a lock, so no cleanup is needed.

## Prerequisites

- SFP Server instance with environment management configured
- Environment registered in SFP Server (or accessible via scratch/sandbox fallback)
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
        uses: flxbl-io/auth-devhub-action@v1
        with:
          sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
          sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

      - name: Lock CI environment
        id: lock
        uses: flxbl-io/lock-environment@v1
        with:
          environment: 'ci-pool-${{ github.run_id }}'
          reason: 'PR #${{ github.event.pull_request.number }}'
          sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
          sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

      - name: Deploy and test
        run: |
          sfp deploy -u ${{ steps.lock.outputs.alias }}
          sfp test -u ${{ steps.lock.outputs.alias }}

      # No unlock step needed - automatic cleanup handles it!
```

## Migration from Manual Unlock

If you were previously using the `unlock-environment` action manually, you can simplify your workflows:

**Before:**
```yaml
- name: Lock environment
  id: lock
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'ci-sandbox-1'
    reason: 'Validation'
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

- name: Run tests
  run: sfp test -u ${{ steps.lock.outputs.alias }}

- name: Unlock environment
  if: always()
  uses: flxbl-io/unlock-environment@v1
  with:
    environment: 'ci-sandbox-1'
    ticket-id: ${{ steps.lock.outputs.ticket-id }}
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}
```

**After:**
```yaml
- name: Lock environment
  id: lock
  uses: flxbl-io/lock-environment@v1
  with:
    environment: 'ci-sandbox-1'
    reason: 'Validation'
    sfp-server-url: ${{ secrets.SFP_SERVER_URL }}
    sfp-server-token: ${{ secrets.SFP_SERVER_TOKEN }}

- name: Run tests
  run: sfp test -u ${{ steps.lock.outputs.alias }}

# Unlock happens automatically!
```

## Related Actions

- [unlock-environment](https://github.com/flxbl-io/unlock-environment) - Manual environment unlock (rarely needed now)
- [auth-devhub-action](https://github.com/flxbl-io/auth-devhub-action) - Authenticate to DevHub

## License

Copyright 2025 flxbl-io. All rights reserved. See [LICENSE](LICENSE) for details.

## Support

- [Documentation](https://docs.flxbl.io)
- [Issues](https://github.com/flxbl-io/lock-environment/issues)
- [flxbl.io](https://flxbl.io)
