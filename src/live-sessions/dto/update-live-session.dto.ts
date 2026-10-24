import { PartialType } from '@nestjs/mapped-types';
import { CreateLiveSessionDto } from './live-session.dto';

/**
 * Body of `PATCH /openings/:openingId/sessions/:id`.
 *
 * A real class, not `Partial<CreateLiveSessionDto>`: TypeScript erases a mapped
 * type to `Object` in the emitted metadata, which makes Nest's ValidationPipe
 * skip the body -- silently disabling the validators and the date transform.
 */
export class UpdateLiveSessionDto extends PartialType(CreateLiveSessionDto) { }