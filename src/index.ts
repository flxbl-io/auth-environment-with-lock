import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Version from package.json
const VERSION = '1.0.0';
const ACTION_NAME = 'auth-environment-with-lock';

interface ExecOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface LockResponse {
  ticketId: string;
  status: string;
  environmentId?: string;
  environmentName?: string;
  duration?: number;
  salesforceUsername?: string;
  accessToken?: string;
  instanceUrl?: string;
}

function printHeader(repository: string, serverUrl: string, environment: string): void {
  const line = '-'.repeat(90);
  console.log(line);
  console.log(`flxbl-actions  -- ❤️  by flxbl.io ❤️  -Version:${VERSION}`);
  console.log(line);
  console.log(`Action     : ${ACTION_NAME}`);
  console.log(`Repository : ${repository}`);
  console.log(`SFP Server : ${serverUrl}`);
  console.log(`Environment: ${environment}`);
  console.log(line);
  console.log();
}

async function execCommand(
  command: string,
  args: string[],
  options: { silent?: boolean; streamStderr?: boolean } = {}
): Promise<ExecOutput> {
  let stdout = '';
  let stderr = '';
  const { silent = false, streamStderr = false } = options;

  const exitCode = await exec.exec(command, args, {
    silent,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        // Stream stderr to console in real-time (shows sfp CLI headers and progress)
        if (streamStderr) {
          process.stdout.write(chunk);
        }
      }
    },
    ignoreReturnCode: true
  });

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

async function lockEnvironment(
  environment: string,
  repository: string,
  duration: string,
  reason: string,
  waitTimeout: string,
  serverUrl: string,
  serverToken: string
): Promise<LockResponse> {
  const args = [
    'server', 'environment', 'lock',
    '--name', environment,
    '--repository', repository,
    '--duration', duration,
    '--sfp-server-url', serverUrl,
    '-t', serverToken,
    '--json'
  ];

  if (reason) {
    args.push('--reason', reason);
  }

  // Always wait for lock acquisition
  const timeoutMinutes = parseInt(waitTimeout, 10);
  if (timeoutMinutes > 0) {
    args.push('--wait-timeout', waitTimeout);
  } else {
    args.push('--wait');
  }

  core.info(`Locking environment: ${environment}`);
  core.info(`Repository: ${repository}`);
  core.info(`Duration: ${duration} minutes`);
  if (reason) {
    core.info(`Reason: ${reason}`);
  }
  if (timeoutMinutes > 0) {
    core.info(`Wait timeout: ${waitTimeout} minutes`);
  } else {
    core.info(`Wait timeout: indefinite`);
  }

  // Stream stderr to show sfp CLI headers and progress, keep stdout silent for JSON parsing
  const result = await execCommand('sfp', args, { silent: true, streamStderr: true });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to lock environment: ${result.stderr || result.stdout}`);
  }

  try {
    const response = JSON.parse(result.stdout) as LockResponse;
    if (!response.ticketId) {
      throw new Error('Lock response did not contain ticket ID');
    }
    return response;
  } catch (parseError) {
    throw new Error(`Failed to parse lock response: ${result.stdout}`);
  }
}

export async function run(): Promise<void> {
  try {
    const environment = core.getInput('environment', { required: true });
    const serverUrl = core.getInput('sfp-server-url', { required: true });
    const serverToken = core.getInput('sfp-server-token', { required: true });
    const repository = core.getInput('repository', { required: false }) || process.env.GITHUB_REPOSITORY || '';
    const duration = core.getInput('duration', { required: false }) || '60';
    const reason = core.getInput('reason', { required: false }) || '';
    const waitTimeout = core.getInput('wait-timeout', { required: false }) || '0';
    const autoUnlock = core.getInput('auto-unlock', { required: false }) !== 'false';

    if (!repository) {
      throw new Error('Repository not specified and GITHUB_REPOSITORY not set');
    }

    // Mark token as secret to prevent exposure in logs
    core.setSecret(serverToken);

    printHeader(repository, serverUrl, environment);

    const lockResponse = await lockEnvironment(
      environment,
      repository,
      duration,
      reason,
      waitTimeout,
      serverUrl,
      serverToken
    );

    core.info(`Environment locked successfully`);
    core.info(`Ticket ID: ${lockResponse.ticketId}`);
    core.info(`Status: ${lockResponse.status}`);

    // Save state for cleanup (auto-unlock)
    if (autoUnlock) {
      core.saveState('TICKET_ID', lockResponse.ticketId);
      core.saveState('ENVIRONMENT', environment);
      core.saveState('REPOSITORY', repository);
      core.saveState('SFP_SERVER_URL', serverUrl);
      core.saveState('SFP_SERVER_TOKEN', serverToken);
      core.saveState('AUTO_UNLOCK', 'true');
    }

    // Set outputs
    core.setOutput('ticket-id', lockResponse.ticketId);
    core.setOutput('alias', environment);

    // Extract credentials if available (when --wait was used and lock acquired)
    if (lockResponse.status === 'acquired') {
      if (lockResponse.accessToken) {
        core.setSecret(lockResponse.accessToken);
        core.setOutput('access-token', lockResponse.accessToken);
      }

      core.setOutput('instance-url', lockResponse.instanceUrl || '');
      core.setOutput('username', lockResponse.salesforceUsername || '');
      core.setOutput('is-active', 'true');
    }

    core.setOutput('auth-method', 'sfp-server');

    core.info('');
    core.info('Environment is now locked and authenticated.');
    if (autoUnlock) {
      core.info('It will be automatically unlocked when the workflow completes.');
    } else {
      core.info('Auto-unlock is disabled. Use unlock-environment action or manual unlock.');
    }

  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('Unknown error occurred');
    }
  }
}

if (require.main === module) {
  run();
}
