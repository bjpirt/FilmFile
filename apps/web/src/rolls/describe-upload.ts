import type { UploadReport } from './upload-scans.ts';

/** What happened to an upload, e.g. "Uploaded 35 scans. 1 was already in the roll." */
export function describeUpload(report: UploadReport): string {
  const parts = [
    `Uploaded ${String(report.uploaded)} ${report.uploaded === 1 ? 'scan' : 'scans'}.`,
  ];
  if (report.alreadyInRoll > 0) {
    parts.push(
      `${String(report.alreadyInRoll)} ${report.alreadyInRoll === 1 ? 'was' : 'were'} already in the roll.`,
    );
  }
  if (report.failed.length > 0) {
    const failures = report.failed.map((f) => `${f.file} (${f.reason})`);
    parts.push(`Not uploaded: ${failures.join(', ')}.`);
  }
  return parts.join(' ');
}
