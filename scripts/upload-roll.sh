#!/usr/bin/env bash
# Creates a roll and uploads a folder of lab scans into it, one frame per scan,
# then prints each scan's thumbnail URL. The service must be running.
#
#   scripts/upload-roll.sh 2026-014 ~/Downloads/1234
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "usage: $0 <roll number, e.g. 2026-014> <folder of JPEG scans>" >&2
  exit 1
fi
roll=$1
folder=$2
api=${FILMFILE_API:-http://127.0.0.1:${FILMFILE_PORT:-4310}/api}
# The service refuses changes without an Origin; its own address is accepted.
origin=${api%/api}

id_of() {
  node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => console.log(JSON.parse(s).id));'
}

post_json() {
  curl --silent --show-error --fail-with-body -X POST -H "Origin: $origin" \
    -H 'Content-Type: application/json' -d "$2" "$api/$1"
}

roll_id=$(post_json rolls "{\"roll\":\"$roll\"}" | id_of)
echo "Roll $roll: $api/rolls/$roll_id"

shopt -s nullglob nocaseglob
# One at a time: the service doesn't yet guard against concurrent changes to a roll.
for scan in "$folder"/*.jpg "$folder"/*.jpeg; do
  name=$(basename "$scan")
  frame_id=$(post_json "rolls/$roll_id/frames" '{}' | id_of)
  version_url="$api/rolls/$roll_id/frames/$frame_id/versions"
  version_id=$(curl --silent --show-error --fail-with-body -X POST -H "Origin: $origin" \
    -H 'Content-Type: image/jpeg' --data-binary "@$scan" \
    "$version_url?file=$name" | id_of)
  echo "$name  $version_url/$version_id/thumbnail?size=small"
done
