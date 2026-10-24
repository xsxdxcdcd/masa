# Step 0: Boundary Analysis

Controllers total 41
Learner pure: 1
Admin pure: 11
Mixed: 20

## Learner pure
- ratings/ratings.controller.ts

## Admin pure
- gamification/gamification.controller.ts
- operations/operations.controller.ts
- support-tickets/support-tickets.controller.ts
- payment-gateways/payment-gateways.controller.ts
- announcement-board/announcement-board.controller.ts
- blog/blog.controller.ts
- instructor-applications/instructor-applications.controller.ts
- finance/finance.controller.ts
- courses/courses.controller.ts
- health/health.controller.ts
- audit/audit.controller.ts

## Mixed
- learning-paths/learning-paths.controller.ts
- announcements/announcements.controller.ts
- commerce/commerce.controller.ts
- grades/grades.controller.ts
- certificates/certificates.controller.ts
- analytics/analytics.controller.ts
- refunds/refunds.controller.ts
- users/users.controller.ts
- lms/reviews.controller.ts
- lms/quizzes.controller.ts
- lms/lessons.controller.ts
- rubrics/rubrics.controller.ts
- tasks/tasks.controller.ts
- instructor-requests/instructor-requests.controller.ts
- live-sessions/live-sessions.controller.ts
- courses/course-openings.controller.ts
- calendar/calendar.controller.ts
- enrollments/enrollments.controller.ts
- chat/chat.controller.ts
- discussions/discussions.controller.ts
## Notes (from quick scan)
- Most cross-boundary imports go from learner-facing services to audit/finance/operations in places (documented conceptually). Full service import graph to be included in Step 1 boundary map.
- Pure learner count is small (1) because many controllers are shared/mixed (20). This matches the tight coupling to User/Course/Enrollment.
- Note: courses.controller.ts contains only ADMIN/COURSE_MANAGER -> pure-admin. course-openings.controller.ts spans learner+admin -> mixed.
