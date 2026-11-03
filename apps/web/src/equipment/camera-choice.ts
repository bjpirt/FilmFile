import type { PickOrAdd } from '../forms/pick-or-add.ts';

/** A new camera's details as entered. */
export interface NewCamera {
  readonly make: string;
  readonly model: string;
}

export type CameraChoice = PickOrAdd<NewCamera>;

export const blankCamera: NewCamera = { make: '', model: '' };
