import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Version from package.json
const VERSION = '1.0.0';
const ACTION_NAME = 'lock-environment (cleanup)';

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

async function execCommand(command: string, args: string[], silent = false): Promise<ExecOutput> {
  let stdout = '';
  let stderr = '';

  const exitCode = await exec.exec(command, args, {
    silent,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      }
    },
    ignoreReturnCode: true
  });

  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

async function unlockEnvironment(
  ticketId: string,
  environment: string,
  serverUrl: string,
  serverToken: string
): Promise<void> {
  const args = [
    'server', 'environment', 'unlock',
    '-e', environment,
    '-t', ticketId,
    '--sfpserverurl', serverUrl,
    '--sfpservertoken', serverToken,
    '--json'
  ];

  core.info(`Unlocking environment: ${environment}`);
  core.info(`Ticket ID: ${ticketId}`);

  const result = await execCommand('sfp', args, true);

  if (result.exitCode !== 0) {
    if (result.stderr) {
      core.debug(`sfp stderr: ${result.stderr}`);
    }
    throw new Error(`Failed to unlock environment: ${result.stderr || result.stdout}`);
  }

  core.info('Environment unlocked successfully');
}

async function run(): Promise<void> {
  try {
    const lockAcquired = core.getState('LOCK_ACQUIRED');
    const ticketId = core.getState('TICKET_ID');
    const environment = core.getState('ENVIRONMENT');
    const serverUrl = core.getState('SFP_SERVER_URL');
    const serverToken = core.getState('SFP_SERVER_TOKEN');

    if (lockAcquired !== 'true') {
      core.info('No lock was acquired in main step, skipping unlock');
      return;
    }

    if (!ticketId || !environment || !serverUrl || !serverToken) {
      core.warning('Missing required state for unlock. The environment may need to be manually unlocked.');
      core.debug(`ticketId: ${ticketId ? 'present' : 'missing'}`);
      core.debug(`environment: ${environment ? 'present' : 'missing'}`);
      core.debug(`serverUrl: ${serverUrl ? 'present' : 'missing'}`);
      core.debug(`serverToken: ${serverToken ? 'present' : 'missing'}`);
      return;
    }

    printHeader(environment, serverUrl);

    await unlockEnvironment(ticketId, environment, serverUrl, serverToken);

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
