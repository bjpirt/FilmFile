/** The one bucket the journeys' local fake of Cloudflare R2 has (FF-234). */
export const journeyBucket = 'journey-site';

/** The fake R2's bucket for backing up the library (FF-225). */
export const journeyBackupBucket = 'journey-backup';

/** The keys the journeys' fake R2 accepts, written to their own credentials file. */
export const journeyR2Keys = {
  accessKeyId: 'JOURNEYKEY',
  secretAccessKey: 'journey-secret',
};

/** Any account ID will do: every one goes to the fake. */
export const journeyAccountId = '0123456789abcdef0123456789abcdef';
