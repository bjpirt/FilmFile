import { expect, test } from 'vitest';
import { aFrame } from '../testing/fake-archive.ts';
import { shownVersion } from './shown-version.ts';

const frame = aFrame('1', '12340001.jpg');
const [first] = frame.versions;
const second = first && { ...first, id: '01JC8Z7K3M00000000000V0002' };
const twoVersions = {
  ...frame,
  versions: [first, second].flatMap((v) => (v ? [v] : [])),
};

test('shows the first version, its lab scan, when none is chosen (D46)', () => {
  expect(shownVersion(twoVersions)?.id).toBe(first?.id);
});

test('shows a version already chosen in roll.json', () => {
  expect(
    shownVersion({ ...twoVersions, defaultVersion: second?.id ?? null })?.id,
  ).toBe(second?.id);
});

test('shows nothing for a frame with no versions', () => {
  expect(shownVersion({ ...frame, versions: [] })).toBeUndefined();
});
