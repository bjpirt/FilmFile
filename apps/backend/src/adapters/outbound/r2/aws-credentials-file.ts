/** The keys of a profile in an AWS credentials file. */
export interface AwsKeys {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/**
 * The keys in `[profile]` of an AWS credentials file's text (the INI format
 * `~/.aws/credentials` uses), or undefined if the profile or either key is
 * missing. Only what's needed is read: no session tokens, no other settings.
 */
export function parseAwsCredentials(
  text: string,
  profile: string,
): AwsKeys | undefined {
  let inProfile = false;
  let accessKeyId: string | undefined;
  let secretAccessKey: string | undefined;
  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }
    const section = /^\[(.*)\]$/u.exec(line);
    if (section !== null) {
      inProfile = section[1]?.trim() === profile;
      continue;
    }
    if (!inProfile) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator < 0) {
      continue;
    }
    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (name === 'aws_access_key_id') {
      accessKeyId = value;
    } else if (name === 'aws_secret_access_key') {
      secretAccessKey = value;
    }
  }
  return accessKeyId === undefined ||
    accessKeyId === '' ||
    secretAccessKey === undefined ||
    secretAccessKey === ''
    ? undefined
    : { accessKeyId, secretAccessKey };
}
