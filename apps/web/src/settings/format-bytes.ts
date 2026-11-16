const units = ['B', 'KB', 'MB', 'GB', 'TB'];

/** A size in bytes as people read it: "512 B", "2 KB", "1.2 GB" (decimal units, one place below 10). */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const shown =
    unit === 0 || value >= 10
      ? String(Math.round(value))
      : value.toFixed(1).replace(/\.0$/u, '');
  return `${shown} ${units[unit] ?? 'B'}`;
}
