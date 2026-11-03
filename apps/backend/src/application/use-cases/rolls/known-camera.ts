import {
  isEquipmentSlug,
  type EquipmentSlug,
} from '../../../domain/equipment/equipment-slug.ts';
import type { ArchiveContext } from '../../../domain/shared/archive-context.ts';
import type { ValidationFailed } from '../../../domain/shared/domain-error.ts';
import { err, ok, type Result } from '../../../domain/shared/result.ts';
import type { EquipmentRepository } from '../../ports/equipment-repository.ts';

/** The slug, if it's a camera in the archive, so a roll never names one that isn't. */
export async function knownCamera(
  equipment: EquipmentRepository,
  ctx: ArchiveContext,
  slug: string,
): Promise<Result<EquipmentSlug, ValidationFailed>> {
  if (isEquipmentSlug(slug) && (await equipment.getCamera(ctx, slug))) {
    return ok(slug);
  }
  return err({
    kind: 'validation-failed',
    issues: [{ path: ['camera'], message: 'is not a camera in the archive' }],
  });
}
