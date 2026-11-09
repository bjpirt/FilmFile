import type { ApiClient } from '@filmfile/contracts/client';
import { useMemo } from 'react';
import { useSettings } from '../settings/use-settings.ts';
import {
  defaultRollNumberPattern,
  patternOf,
  type RollNumberPattern,
} from './roll-number-pattern.ts';

/** The roll number pattern saved in the settings, once they're read (D88). */
export function useRollNumberPattern(api: ApiClient): RollNumberPattern {
  const settings = useSettings(api);
  const source =
    settings.data?.settings.rollNumberPattern ?? defaultRollNumberPattern;
  return useMemo(() => patternOf(source), [source]);
}
