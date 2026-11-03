import type { EquipmentChoice } from './equipment-choice.ts';

/** A new camera's details as entered. */
export interface NewCamera {
  readonly make: string;
  readonly model: string;
}

export type CameraChoice = EquipmentChoice<NewCamera>;

export const blankCamera: NewCamera = { make: '', model: '' };
