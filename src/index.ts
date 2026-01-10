import * as core from '@actions/core';
import * as exec from '@actions/exec';

// Version from package.json
const VERSION = '1.0.0';
const ACTION_NAME = 'lock-environment';

interface ExecOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface LockResponse {
  ticketId: string;
  environment: string;
  lockedBy: string;
  expiresAt: string;
}

interface OrgInfo {
  alias?: string;
  username?: string;
  orgId?: string;
  instanceUrl?: string;
  loginUrl?: string;
  accessToken?: string;
  isActive?: boolean;
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

async function lockEnvironment(
  environment: string,
  serverUrl: string,
  serverToken: string,
  duration: string,
  reason: string,
  wait: boolean
): Promise<LockResponse> {
  const args = [
    'server', 'environment', 'lock',
    '-e', environment,
    '--sfpserverurl', serverUrl,
    '--sfpservertoken', serverToken,
    '-d', duration,
    '-r', reason,
    '--json'
  ];

  if (wait) {
    args.push('--wait');
  }

  core.info(`Locking environment: ${environment}`);
  core.info(`Duration: ${duration} minutes`);
  core.info(`Reason: ${reason}`);
  core.info(`Wait for lock: ${wait}`);

  const result = await execCommand('sfp', args, true);

  if (result.exitCode !== 0) {
    if (result.stderr) {
      core.debug(`sfp stderr: ${result.stderr}`);
    }
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

async function authenticateOrg(
  environment: string,
  serverUrl: string,
  serverToken: string
): Promise<OrgInfo> {
  const loginArgs = [
    'server', 'org', 'login',
    '-e', environment,
    '--sfpserverurl', serverUrl,
    '--sfpservertoken', serverToken,
    '-a', environment,
    '--json'
  ];

  core.info(`Authenticating to environment: ${environment}`);

  const loginResult = await execCommand('sfp', loginArgs, true);

  if (loginResult.exitCode !== 0) {
    if (loginResult.stderr) {
      core.debug(`sfp login stderr: ${loginResult.stderr}`);
    }
    throw new Error(`Failed to authenticate: ${loginResult.stderr || loginResult.stdout}`);
  }

  let orgInfo: OrgInfo = { alias: environment };

  try {
    const loginResponse = JSON.parse(loginResult.stdout);
    orgInfo = {
      alias: environment,
      username: loginResponse.username,
      orgId: loginResponse.orgId,
      instanceUrl: loginResponse.instanceUrl,
      loginUrl: loginResponse.loginUrl,
      accessToken: loginResponse.accessToken,
      isActive: loginResponse.isActive ?? true
    };
  } catch {
    core.debug('Could not parse login response, fetching org info separately');
  }

  if (!orgInfo.username || !orgInfo.orgId) {
    const displayArgs = ['org', 'display', '-o', environment, '--json'];
    const displayResult = await execCommand('sf', displayArgs, true);

    if (displayResult.exitCode === 0) {
      try {
        const displayResponse = JSON.parse(displayResult.stdout);
        const result = displayResponse.result || displayResponse;
        orgInfo = {
          ...orgInfo,
          username: orgInfo.username || result.username,
          orgId: orgInfo.orgId || result.id || result.orgId,
          instanceUrl: orgInfo.instanceUrl || result.instanceUrl,
          loginUrl: orgInfo.loginUrl || result.loginUrl || result.sfdxAuthUrl,
          accessToken: orgInfo.accessToken || result.accessToken,
          isActive: orgInfo.isActive ?? (result.connectedStatus === 'Connected')
        };
      } catch {
        core.debug('Could not parse sf org display response');
      }
    }
  }

  return orgInfo;
}

export async function run(): Promise<void> {
  try {
    const environment = core.getInput('environment', { required: true });
    const serverUrl = core.getInput('sfp-server-url', { required: true });
    const serverToken = core.getInput('sfp-server-token', { required: true });
    const repository = core.getInput('repository', { required: false }) || process.env.GITHUB_REPOSITORY || '';
    const duration = core.getInput('duration', { required: false }) || '60';
    const reason = core.getInput('reason', { required: true });
    const wait = core.getInput('wait', { required: false }) !== 'false';

    if (!repository) {
      throw new Error('Repository not specified and GITHUB_REPOSITORY not set');
    }

    printHeader(repository, serverUrl, environment);

    const lockResponse = await lockEnvironment(
      environment,
      serverUrl,
      serverToken,
      duration,
      reason,
      wait
    );

    core.info(`Environment locked successfully`);
    core.info(`Ticket ID: ${lockResponse.ticketId}`);
    core.info(`Expires at: ${lockResponse.expiresAt}`);

    core.saveState('TICKET_ID', lockResponse.ticketId);
    core.saveState('ENVIRONMENT', environment);
    core.saveState('SFP_SERVER_URL', serverUrl);
    core.saveState('SFP_SERVER_TOKEN', serverToken);
    core.saveState('LOCK_ACQUIRED', 'true');

    core.setOutput('ticket-id', lockResponse.ticketId);

    const orgInfo = await authenticateOrg(environment, serverUrl, serverToken);

    core.info(`Authentication successful`);
    core.info(`Alias: ${orgInfo.alias}`);
    core.info(`Username: ${orgInfo.username || 'N/A'}`);
    core.info(`Org ID: ${orgInfo.orgId || 'N/A'}`);

    core.setOutput('alias', orgInfo.alias);
    core.setOutput('is-active', String(orgInfo.isActive ?? true));
    core.setOutput('org-id', orgInfo.orgId || '');
    core.setOutput('instance-url', orgInfo.instanceUrl || '');
    core.setOutput('login-url', orgInfo.loginUrl || '');
    core.setOutput('username', orgInfo.username || '');
    core.setOutput('auth-method', 'sfp-server');

    if (orgInfo.accessToken) {
      core.setSecret(orgInfo.accessToken);
      core.setOutput('access-token', orgInfo.accessToken);
    }

    core.info('');
    core.info('Environment is now locked and authenticated.');
    core.info('It will be automatically unlocked when the workflow completes.');

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
