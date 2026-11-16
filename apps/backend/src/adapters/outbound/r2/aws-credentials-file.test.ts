import { describe, expect, test } from 'vitest';
import { parseAwsCredentials } from './aws-credentials-file.ts';

const file = `# my keys
[default]
aws_access_key_id = DEFAULTKEY
aws_secret_access_key = defaultsecret

[filmfile]
aws_access_key_id=FILMKEY
; a comment
aws_secret_access_key =  film/secret+value

[other]
aws_access_key_id = OTHER
aws_secret_access_key = other
`;

describe('parseAwsCredentials', () => {
  test('reads the keys of the named profile only', () => {
    expect(parseAwsCredentials(file, 'filmfile')).toEqual({
      accessKeyId: 'FILMKEY',
      secretAccessKey: 'film/secret+value',
    });
  });

  test('reads a file with Windows line endings', () => {
    expect(
      parseAwsCredentials(
        '[filmfile]\r\naws_access_key_id = A\r\naws_secret_access_key = B\r\n',
        'filmfile',
      ),
    ).toEqual({ accessKeyId: 'A', secretAccessKey: 'B' });
  });

  test('has nothing for a profile that is not there', () => {
    expect(parseAwsCredentials(file, 'missing')).toBeUndefined();
  });

  test.each([
    ['no secret', '[filmfile]\naws_access_key_id = A\n'],
    ['no key ID', '[filmfile]\naws_secret_access_key = B\n'],
    [
      'an empty secret',
      '[filmfile]\naws_access_key_id = A\naws_secret_access_key =\n',
    ],
    ['nothing', ''],
  ])('has nothing for a profile with %s', (_name, text) => {
    expect(parseAwsCredentials(text, 'filmfile')).toBeUndefined();
  });

  test('does not take keys from another profile that follows', () => {
    expect(
      parseAwsCredentials(
        '[filmfile]\naws_access_key_id = A\n[default]\naws_secret_access_key = B\n',
        'filmfile',
      ),
    ).toBeUndefined();
  });
});
