import { PartialType } from '@nestjs/mapped-types';
import { CreateOpeningDto } from './create-opening.dto';

/**
 * Body of `PATCH /openings/:id`.
 *
 * This has to be a real class rather than `Partial<CreateOpeningDto>` written
 * inline at the controller: TypeScript erases a mapped type to `Object` when it
 * emits the `design:paramtypes` metadata, so Nest's ValidationPipe sees a plain
 * `Object` and skips the whole pipeline. That silently disabled every
 * validator and every `@Transform` on this endpoint, so the `startDate` that
 * `<input type="date">` sends ("2026-10-01") reached Prisma unparsed and the
 * update failed with a 500. `PartialType` re-inherits the metadata, so the
 * dates are normalised to a full ISO string exactly like on create.
 */
export class UpdateOpeningDto extends PartialType(CreateOpeningDto) { }