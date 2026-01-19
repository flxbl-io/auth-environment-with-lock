import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Version from package.json
const VERSION = '1.0.0';
const ACTION_NAME = 'auth-environment-with-lock (cleanup)';

interface ExecOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function printHeader(environment: string, serverUrl: string): void {
  const line = '-'.repeat(90);
  console.log(line);
  console.log(`flxbl-actions  -- ❤️  by flxbl.io ❤️  -Version:${VERSION}`);
  console.log(line);
  console.log(`Action     : ${ACTION_NAME}`);
  console.log(`Environment: ${environment}`);
  console.log(`SFP Server : ${serverUrl}`);
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

async function unlockEnvironment(
  ticketId: string,
  environment: string,
  repository: string,
  serverUrl: string,
  serverToken: string
): Promise<void> {
  const args = [
    'server', 'environment', 'unlock',
    '--name', environment,
    '--repository', repository,
    '--ticket-id', ticketId,
    '--sfp-server-url', serverUrl,
    '-t', serverToken
  ];

  core.info(`Unlocking environment: ${environment}`);
  core.info(`Ticket ID: ${ticketId}`);

  // Stream stderr to show sfp CLI headers and progress
  const result = await execCommand('sfp', args, { silent: true, streamStderr: true });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to unlock environment: ${result.stderr || result.stdout}`);
  }

  core.info('Environment unlocked successfully');
}

async function run(): Promise<void> {
  try {
    const autoUnlock = core.getState('AUTO_UNLOCK');
    const ticketId = core.getState('TICKET_ID');
    const environment = core.getState('ENVIRONMENT');
    const repository = core.getState('REPOSITORY');
    const serverUrl = core.getState('SFP_SERVER_URL');
    const serverToken = core.getState('SFP_SERVER_TOKEN');

    if (autoUnlock !== 'true') {
      core.info('Auto-unlock is disabled, skipping cleanup');
      return;
    }

    if (!ticketId || !environment || !repository || !serverUrl || !serverToken) {
      core.warning('Missing required state for unlock. The environment may need to be manually unlocked.');
      core.debug(`ticketId: ${ticketId ? 'present' : 'missing'}`);
      core.debug(`environment: ${environment ? 'present' : 'missing'}`);
      core.debug(`repository: ${repository ? 'present' : 'missing'}`);
      core.debug(`serverUrl: ${serverUrl ? 'present' : 'missing'}`);
      core.debug(`serverToken: ${serverToken ? 'present' : 'missing'}`);
      return;
    }

    // Mark token as secret to prevent exposure in logs
    core.setSecret(serverToken);

    printHeader(environment, serverUrl);

    await unlockEnvironment(ticketId, environment, repository, serverUrl, serverToken);

    core.info('');
    core.info('Cleanup completed successfully.');

  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Cleanup failed: ${error.message}`);
      core.warning('The environment may need to be manually unlocked.');
    } else {
      core.warning('Cleanup failed with unknown error');
    }
  }
}

run();
