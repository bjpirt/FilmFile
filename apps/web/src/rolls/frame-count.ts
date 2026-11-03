/** "No frames yet", "1 frame" or "36 frames". */
export function frameCount(frames: number): string {
  if (frames === 0) {
    return 'No frames yet';
  }
  return frames === 1 ? '1 frame' : `${String(frames)} frames`;
}
