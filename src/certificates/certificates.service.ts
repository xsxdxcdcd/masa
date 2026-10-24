import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Role, CertificateStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CertificatesService {
    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
        private notifications: NotificationsService,
    ) { }

    /**
     * Compose the exact set of students that MAY receive a certificate for an
     * opening: those with an APPROVED enrollment on that specific batch.
     */
    async listCandidates(openingId: string) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true, certificateIssued: true } },
            },
        });
        if (!opening) throw new NotFoundException('Opening not found');

        const enrollments = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED' },
            select: {
                studentId: true,
                student: { select: { email: true } },
            },
        });

        const issued = await this.prisma.certificate.findMany({
            where: { courseId: opening.courseId },
            select: { id: true, studentId: true, verificationStatus: true },
        });
        const issuedBy = new Map<string, { id: string; status: string }>();
        for (const c of issued) issuedBy.set(c.studentId, { id: c.id, status: c.verificationStatus });

        // Openings generate a course-level certificate: a student can only have
        // one per course, so re-issuing to an already-certified student is a
        // re-issue — flag it as such rather than silently skipping.
        return enrollments.map(e => {
            const ex = issuedBy.get(e.studentId);
            return {
                studentId: e.studentId,
                email: e.student.email,
                certificateStatus: ex?.status ?? null,
                certificateId: ex?.id ?? null,
            };
        });
    }

    /**
     * Manually issue certificates for the SELECTED students of an opening.
     * Requires the course to be configured to grant certificates
     * (`course.certificateIssued`), and only APPROVED enrollments of that
     * opening are eligible. Fully audit-logged.
     */
    async issueForStudents(openingId: string, studentIds: string[], actorId: string, actorRole: Role) {
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            include: {
                course: { select: { id: true, titleAr: true, titleEn: true, certificateIssued: true } },
            },
        });
        if (!opening) throw new NotFoundException('Opening not found');
        if (!opening.course.certificateIssued) {
            throw new BadRequestException('This course is not configured to issue certificates');
        }
        // Certificates are granted after the batch finishes and the instructor
        // reviews performance; opening must have ended so we don't hand out
        // certificates for a course still in progress.
        if (opening.status !== 'ENDED') {
            throw new BadRequestException('Certificates can only be issued after the course opening has ended');
        }

        const enrollments = await this.prisma.enrollment.findMany({
            where: { openingId, status: 'APPROVED', studentId: { in: studentIds } },
            select: { studentId: true },
        });
        const eligible = new Set(enrollments.map(e => e.studentId));

        const issued: string[] = [];
        for (const studentId of new Set(studentIds)) {
            if (!eligible.has(studentId)) continue;
            const existing = await this.prisma.certificate.findFirst({
                where: { studentId, courseId: opening.courseId },
            });
            if (existing) {
                if (existing.verificationStatus === CertificateStatus.VALID) continue;
                // Re-affirming a certificate that was revoked/expired.
                const cert = await this.prisma.certificate.update({
                    where: { id: existing.id },
                    data: { verificationStatus: CertificateStatus.VALID, issuingDate: new Date() },
                });
                issued.push(cert.id);
            } else {
                const cert = await this.prisma.certificate.create({
                    data: { studentId, courseId: opening.courseId },
                });
                issued.push(cert.id);
            }
            await this.notifications.notify({
                userId: studentId,
                type: 'certificate.issued',
                titleAr: 'تم إصدار شهادتك',
                titleEn: 'Certificate issued',
                bodyAr: `تم إصدار شهادتك في دورة: ${opening.course.titleAr}`,
                bodyEn: `Your certificate for "${opening.course.titleEn}" has been issued.`,
                data: { certificateId: issued[issued.length - 1], courseId: opening.courseId },
            }).catch(() => {});
        }

        if (issued.length > 0) {
            await this.audit.logAction(
                `Issued ${issued.length} certificate(s) for Opening ${openingId} (${studentIds.length} selected)`,
                undefined,
                actorId,
            );
        }
        return { issued, count: issued.length };
    }

    /**
     * Every certificate issued for a course, with its holder. Certificates are
     * course-level by design (one per student per course, no opening link), so
     * this is the authoritative "who holds a certificate for this course" list
     * for staff. Student-side routes intentionally never expose other people's
     * emails, so this stays behind ADMIN / COURSE_MANAGER.
     */
    async listForCourse(courseId: string) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
        });
        if (!course) throw new NotFoundException('Course not found');

        const certificates = await this.prisma.certificate.findMany({
            where: { courseId },
            select: {
                id: true,
                verificationCode: true,
                issuingDate: true,
                verificationStatus: true,
                createdAt: true,
                student: { select: { id: true, email: true } },
                printedAt: true,
                printedBy: { select: { id: true, email: true } },
            },
            orderBy: { issuingDate: 'desc' },
        });

        const counts = {
            VALID: 0,
            REVOKED: 0,
            EXPIRED: 0,
        } as Record<CertificateStatus, number>;
        for (const c of certificates) counts[c.verificationStatus] += 1;

        return {
            course,
            counts,
            total: certificates.length,
            // Split from `total` on purpose: an issued certificate and a
            // certificate that actually reached the student on paper are
            // different facts, and a wrap-up report needs both.
            printed: certificates.filter((c) => c.printedAt !== null).length,
            certificates,
        };
    }

    /**
     * Record that a certificate was released on paper, and by whom.
     *
     * Re-printing moves the timestamp forward instead of keeping the first
     * one: the useful question in a wrap-up report is "when did we last hand
     * this over", and a replacement copy supersedes the original. A revoked
     * certificate is refused so the ledger cannot claim a handover of a
     * credential that is no longer valid.
     */
    async markPrinted(id: string, actor: { userId: string; role: Role }) {
        const certificate = await this.prisma.certificate.findUnique({
            where: { id },
            select: {
                id: true,
                studentId: true,
                verificationStatus: true,
                courseId: true,
                course: { select: { titleAr: true, titleEn: true } },
            },
        });
        if (!certificate) throw new NotFoundException('Certificate not found');
        if (certificate.verificationStatus === CertificateStatus.REVOKED) {
            throw new BadRequestException('A revoked certificate cannot be printed');
        }

        // Staff release certificates at the office; a student may also print
        // their own from the dashboard, so ownership is honoured here rather
        // than by a blanket role restriction on the route.
        const isOwner = certificate.studentId === actor.userId;
        if (!isOwner) {
            // A certificate with no course cannot be matched to a teaching
            // assignment, so only platform staff may release it.
            if (!certificate.courseId) {
                if (actor.role !== Role.ADMIN && actor.role !== Role.COURSE_MANAGER) {
                    throw new ForbiddenException('You cannot print this certificate');
                }
            } else {
                await this.assertCanReleaseCertificate(certificate.courseId, actor.userId, actor.role);
            }
        }

        const previous = await this.prisma.certificate.findUnique({
            where: { id },
            select: { printedAt: true },
        });

        const updated = await this.prisma.certificate.update({
            where: { id },
            data: { printedAt: new Date(), printedById: actor.userId },
            select: {
                id: true,
                printedAt: true,
                printedBy: { select: { id: true, email: true } },
            },
        });

        // Printing is a custody event, not a cosmetic flag: the whole point of
        // the ledger is being able to answer "who released this, and when", so
        // it is written to the audit trail like issue / revoke / reissue are.
        // A reprint is recorded distinctly from the first handover.
        await this.audit.logAction(
            previous?.printedAt
                ? `Re-printed certificate ${id} for course "${certificate.course?.titleEn ?? certificate.courseId}" (first printed ${previous.printedAt.toISOString()})`
                : `Printed certificate ${id} for course "${certificate.course?.titleEn ?? certificate.courseId}"`,
            undefined,
            actor.userId,
        );

        return updated;
    }

    /**
     * Staff gate for releasing a certificate the caller does not own. Mirrors
     * assertCanManageOpening: ADMIN / COURSE_MANAGER pass, an INSTRUCTOR must
     * actually teach the course or one of its batches. Without the instructor
     * check, any teacher on the platform could stamp their own name as the
     * releaser of an unrelated student's certificate.
     */
    private async assertCanReleaseCertificate(courseId: string, userId: string, role: Role) {
        if (role === Role.ADMIN || role === Role.COURSE_MANAGER) return;
        if (role !== Role.INSTRUCTOR) {
            throw new ForbiddenException('You cannot print this certificate');
        }
        const [course, teachesOpening] = await Promise.all([
            this.prisma.course.findUnique({ where: { id: courseId }, select: { instructorId: true } }),
            this.prisma.courseOpening.findFirst({
                where: { courseId, instructorId: userId },
                select: { id: true },
            }),
        ]);
        if (course?.instructorId !== userId && !teachesOpening) {
            throw new ForbiddenException('You do not teach this course');
        }
    }

    async revoke(id: string, actorId: string, actorRole: Role) {
        const cert = await this.prisma.certificate.findUnique({ where: { id } });
        if (!cert) throw new NotFoundException('Certificate not found');
        if (cert.verificationStatus !== CertificateStatus.VALID) {
            throw new BadRequestException('Only a valid certificate can be revoked');
        }
        const updated = await this.prisma.certificate.update({
            where: { id },
            data: { verificationStatus: CertificateStatus.REVOKED },
        });
        await this.audit.logAction(`Revoked certificate ${id}`, undefined, actorId);
        return updated;
    }

    async reissue(id: string, actorId: string, actorRole: Role) {
        const cert = await this.prisma.certificate.findUnique({ where: { id } });
        if (!cert) throw new NotFoundException('Certificate not found');
        const updated = await this.prisma.certificate.update({
            where: { id },
            data: { verificationStatus: CertificateStatus.VALID, issuingDate: new Date() },
        });
        await this.audit.logAction(`Reissued certificate ${id}`, undefined, actorId);
        return updated;
    }

    /**
     * Checks that the actor may manage certificates for the opening: the
     * opening's instructor, or ADMIN / COURSE_MANAGER.
     */
    async assertCanManageOpening(openingId: string, userId: string, role: Role) {
        if (role === Role.ADMIN || role === Role.COURSE_MANAGER) return;
        if (role !== Role.INSTRUCTOR) throw new ForbiddenException('Only the batch instructor or an admin can manage certificates');
        const opening = await this.prisma.courseOpening.findUnique({
            where: { id: openingId },
            select: { instructorId: true },
        });
        if (!opening) throw new NotFoundException('Opening not found');
        if (opening.instructorId !== userId) {
            throw new ForbiddenException('You do not teach this batch');
        }
    }

    /**
     * The student's own certificates, for the dashboard profile.
     *
     * `printedAt` is the only print fact exposed here: the holder learns that
     * the paper copy reached them and when, which is what they need. Who handed
     * it over is staff information and stays on the course report
     * (listForCourse), where the reader is a COURSE_MANAGER / ADMIN.
     */
    async listMine(studentId: string) {
        return this.prisma.certificate.findMany({
            where: { studentId },
            select: {
                id: true,
                verificationCode: true,
                issuingDate: true,
                verificationStatus: true,
                printedAt: true,
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
            orderBy: { issuingDate: 'desc' },
        });
    }

    async getByCourse(courseId: string, studentId: string) {
        const cert = await this.prisma.certificate.findFirst({
            where: { studentId, courseId },
            include: {
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
        });
        if (!cert) throw new NotFoundException('Certificate not found for this course');
        return cert;
    }

    async getOne(id: string, studentId: string, role: Role) {
        const cert = await this.prisma.certificate.findUnique({
            where: { id },
            include: {
                // `metadata` carries the holder's real name (nameEn / fullName),
                // so the printed certificate shows a person and not an email
                // prefix. Safe to expose here: this action is owner-or-ADMIN,
                // unlike getPublicById which never selects it.
                student: { select: { id: true, email: true, metadata: true } },
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
        });
        if (!cert) throw new NotFoundException('Certificate not found');
        if (role !== Role.ADMIN && cert.studentId !== studentId) {
            throw new ForbiddenException('You are not allowed to view this certificate');
        }
        const { student, ...rest } = cert;
        return {
            ...rest,
            // Identity is unchanged from before; only the derived name is new.
            student: student ? { id: student.id, email: student.email } : null,
            holderName: this.displayName(student, true),
        };
    }

    async verifyByCode(code: string) {
        if (!code) {
            return { valid: false, certificate: null };
        }
        const cert = await this.prisma.certificate.findUnique({
            where: { verificationCode: code },
            include: {
                student: { select: { id: true } }, // Never expose email publicly
                course: {
                    select: { id: true, titleAr: true, titleEn: true, certificateIssued: true },
                },
            },
        });
        if (!cert) {
            return { valid: false, certificate: null };
        }
        return {
            valid: cert.verificationStatus === 'VALID',
            certificate: {
                id: cert.id,
                verificationCode: cert.verificationCode,
                issuingDate: cert.issuingDate,
                verificationStatus: cert.verificationStatus,
                student: cert.student,
                course: cert.course,
            },
        };
    }

    /**
     * The printable name for a person on a certificate.
     *
     * Certificates used to fall back to the email local-part, which meant the
     * public sheet printed "Student" and "Instructor" instead of a name. A
     * certificate that can be verified but shows nobody is useless, so the name
     * itself is deliberately public — the identifying data (email, phone) is
     * not. `allowEmailFallback` is therefore off on public responses so an
     * unauthenticated visitor never receives a fragment of somebody's email.
     */
    private displayName(
        person: { email?: string | null; metadata?: unknown } | null | undefined,
        allowEmailFallback: boolean,
    ): string {
        const md = (person?.metadata ?? null) as Record<string, unknown> | null;
        const explicit = [md?.nameEn, md?.nameAr, md?.fullName].find(
            (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );
        if (explicit) return explicit.trim();
        return allowEmailFallback ? (person?.email?.split('@')[0] ?? '') : '';
    }

    async getPublicById(id: string) {
        const cert = await this.prisma.certificate.findUnique({
            where: { id },
            include: {
                // metadata is selected only to derive the printable name; the
                // raw blob is never returned.
                student: { select: { id: true, metadata: true } }, // Never expose email publicly
                course: {
                    select: {
                        id: true,
                        titleAr: true,
                        titleEn: true,
                        certificateIssued: true,
                        openings: {
                            select: {
                                instructor: { select: { id: true, metadata: true } }, // Never expose email publicly
                            },
                            take: 1,
                        },
                    },
                },
            },
        });
        if (!cert) {
            return null;
        }
        return {
            id: cert.id,
            verificationCode: cert.verificationCode,
            issuingDate: cert.issuingDate,
            verificationStatus: cert.verificationStatus,
            student: cert.student ? { id: cert.student.id } : null,
            holderName: this.displayName(cert.student, false),
            instructorName: this.displayName(cert.course?.openings?.[0]?.instructor, false),
            course: cert.course ? {
                id: cert.course.id,
                titleAr: cert.course.titleAr,
                titleEn: cert.course.titleEn,
            } : null,
        };
    }
}