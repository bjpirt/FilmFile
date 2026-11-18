// sharp's native packages in @img: sharp-darwin-arm64, sharp-libvips-darwin-x64.
const native = /^sharp-(?:libvips-)?darwin-(?<arch>[a-z0-9]+)$/;

/**
 * Why the app's sharp files are wrong for an `arch` Mac, or undefined if
 * they're right (FF-161): it must hold sharp's native packages for its own
 * architecture, and no other's. `names` are the folders in its
 * `node_modules/@img`; others there (`colour`) aren't native, and don't count.
 */
export function sharpArchitectureProblem(
  names: readonly string[],
  arch: string,
): string | undefined {
  const held = [
    ...new Set(
      names.flatMap((name) => {
        const found = native.exec(name)?.groups?.arch;
        return found === undefined ? [] : [found];
      }),
    ),
  ].sort();
  if (held.length === 0) {
    return `FilmFile.app would hold no sharp; it should hold ${arch}’s.`;
  }
  if (held.length === 1 && held[0] === arch) {
    return undefined;
  }
  return `FilmFile.app would hold sharp for ${held.join(' and ')}; it should hold only ${arch}’s.`;
}
