import { BadRequestException } from '@nestjs/common';
import { CourseContentType } from '@prisma/client';

/**
 * The two guards that keep a course's content type honest.
 *
 * A course is either taught live on Meet or delivered as pre-recorded videos,
 * and the two are presented through different surfaces. Storing the type alone
 * would let a course claim to be live while shipping a video library, which is
 * exactly the confusion this replaces, so the two rules live here and are
 * enforced on every write:
 *
 *   - a LIVE course carries no lesson videos (its lessons happen at the meeting);
 *   - a RECORDED course has no meeting schedule (its lessons happen in the video).
 *
 * Course-level `introVideoUrl` / `videoFileUrl` are deliberately exempt: those
 * are the trailer shown on the sales page and make sense for either format.
 */

/** The shape of a lesson inside a course create/update payload. */
export type LessonDraft = {
    videoUrl?: string | null;
    /** Chapter number in the payload; only used to point at the offending lesson. */
    chapterIndex?: number;
};

export function assertLessonVideosAllowed(
    contentType: CourseContentType | null | undefined,
    lessons: LessonDraft[] | null | undefined,
) {
    // A missing type is the pre-migration shape, so it is read as LIVE: a legacy
    // payload must not be able to sneak videos past the rule, and the only way to
    // be sure a video is wanted is to say so explicitly.
    const effective = contentType ?? CourseContentType.LIVE;
    if (effective !== CourseContentType.LIVE) return;

    const offender = (lessons ?? []).find((lesson) => !!lesson.videoUrl?.trim());
    if (!offender) return;

    const where = offender.chapterIndex === undefined ? '' : ` (chapter ${offender.chapterIndex + 1})`;
    throw new BadRequestException(
        `This is a live course, so its lessons are meetings and cannot have a video${where}. ` +
        'Remove the video, or switch the course to pre-recorded.',
    );
}

export function assertLiveSessionsAllowed(contentType: CourseContentType | null | undefined) {
    if (contentType === CourseContentType.RECORDED) {
        throw new BadRequestException(
            'This is a pre-recorded course, so it has no live sessions. ' +
            'Switch the course to live to schedule a meeting.',
        );
    }
}
