#!/bin/sh
# Makes icon.icns from icon.svg, with sharp (from the service) and macOS's iconutil.
# Run again after changing icon.svg; icon.icns is kept in the repository.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
set_dir=$(mktemp -d)/icon.iconset
mkdir -p "$set_dir"
cd "$here/../../backend"
node --input-type=module -e "
import sharp from 'sharp';
const [svg, dir] = process.argv.slice(1);
for (const size of [16, 32, 128, 256, 512]) {
  await sharp(svg, { density: 300 }).resize(size).png().toFile(dir + '/icon_' + size + 'x' + size + '.png');
  await sharp(svg, { density: 300 }).resize(size * 2).png().toFile(dir + '/icon_' + size + 'x' + size + '@2x.png');
}
" "$here/icon.svg" "$set_dir"
iconutil -c icns "$set_dir" -o "$here/icon.icns"
