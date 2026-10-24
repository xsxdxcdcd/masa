# تحليل + خطة الفصل (موافقة مطلوبة قبل التنفيذ)

هذا التحليل مبني على المسح الفعلي للكود الحالي (Schema + Controllers + Services + Modules).

## 1. فهم الحالة الحالية

التطبيق عبارة عن **monolith واحد** مع:
- Prisma/Postgres واحد
- JWT موحّد (access + refresh)
- Guards موحّدة (`JwtAuthGuard`, `RolesGuard`)
- ~71 موديل، ~322 FK، علاقات كثيرة مباشرة بين الجداول

## 2. نقاط الترابط الحرجة (Critical Couplings)

أهم الروابط التي تجعل الفصل "ليس سهلاً الآن":

| المجال | مثال العلاقات (FKs) | السبب |
|---|---|---|
| **User <-> كل شيء** | `User` مرتبط بـ Enrollments, Certificates, Payments, Refunds, AuditLogs, Chat, Messages, Reviews, Coupons, OperationsAllowlist | المستخدم مشترك بين Learner وAdmin. فصل DB بدون مزامنة يكسر العلاقات. |
| **Enrollments–Courses–Instructors–Students** | `Enrollment.userId` (طالب)، `Course.instructorId`/relations، `CourseOpening` | الطالب والمدرس مرتبطان مباشرة بالدورة والتسجيلات. كثير من الاستعلامات تستخدم `include` عميق (JOIN مباشر). |
| **Certificates** | `Certificate.studentId` + `Certificate.courseId` + `printedById` (staff) | الشهادة تربط الطالب بالدورة، و`printedBy` هو مدير/موظف (Admin boundary). |
| **Payments + Refunds + Coupons** | `Payment.userId`, `Payment.gatewayId`, `RefundRequest.studentId + reviewedById`, `Coupon*` | مالية حساسة (Admin/Finance). الطالب يرفع إيصال/يطلب استرداد، الإدارة تراجع/توافق. علاقات مباشرة بين `Payment` و`Enrollment`/`User`. |
| **Chat/Messages** | `DirectChat`/`DirectMessage` بين Student–Instructor | يتطلب وجود المستخدمين في نفس "فضاء" الهوية. فصل الهوية يعقده. |
| **Reviews/Ratings** | `CourseReview` يربط Student → Course | learner-only في الغالب لكن لا يلامس Admin مباشرة. |
| **AuditLog** | مرتبط بـ `User` (optional) | إداري حساس (يجب حمايته من التعديل). |
| **Operations** | `OperationsAllowlistEntry.userId` + تغييرات من Admin | إداري بالكامل. |

النتيجة: **هناك تداخل قوي** بين Learner وAdministration عبر `User` والجداول المالية.

## 3. ما الذي أقترح فصله؟ (Boundaries المقترحة)

### A. Learner System (منظومة الطالب+المدرس)

**الهدف**: بيئة تعليمية يومية، أقل امتيازًا.

**Modules/Controllers (مرشح):**
- `courses`, `course-openings`, `lms` (lessons/quizzes), `enrollments`, `grades` (جزء learner)، `certificates` (read/student + issuance ذات صلة بالتدريس)، `chat`, `messages`, `discussions`, `learning-paths`, `calendar` (learner), `analytics` (learner), `gamification` (learner-facing)، `ratings/reviews`, `referrals` (learner)، `wishlist`, `notifications` (learner/instructor)، `instructor-applications`, `instructor-requests`, `blog` (عام)، `live-sessions`, `refunds` (طلب الطالب فقط: create/list own).

**Roles**: `STUDENT`, `INSTRUCTOR`

### B. Administration System (منظومة إدارية/مالية حساسة)

**الهدف**: عزل حقيقي. وصول عالي الامتياز.

**Modules (مرشح):**
- `finance` (كامل)، `payments` gateways، `coupons`, `refunds` (review/approve/reject)، `users` (user management)، `audit`, `operations`, `announcement-board`, `announcements` (إدارية)، `support-tickets`, `payment-gateways`, `commerce` (أجزاء إدارية)، `certificates` (إصدار/إلغاء/طباعة من staff)، `analytics` (admin)، `consent`/system settings إن وجدت.

**Roles**: `COURSE_MANAGER`, `FINANCE`, `ADMIN` (+ افتراضيًا `SUPER_ADMIN` مستقبلي إن رغبت).

> ملاحظة: `CourseManager` إداري (إدارة كورسات/فتح دفعات) — أنسب له أن يكون في Admin boundary وليس Learner boundary.

## 4. ما الذي سيبقى مشتركًا؟

**ضروري للحفاظ على العلاقات (لا نكرر DB):**

| عنصر | السبب |
|---|---|
| **قاعدة بيانات واحدة (Postgres)** | الحفاظ على FKs، JOINs، النزاهة (Enrollments/Certificates/Payments). التكرار/Sync خطر كبير ومعقد. هذا يتوافق مع طلبك "استخدام مشتركة إن كان أكثر أمانًا". |
| **مستخدمو النظام (Users)** | جدول `User` واحد. الهوية مركزية. فصل الهوية بالكامل (auth منفصل تمامًا) سيكسر العلاقات الطبيعية Student–Instructor ويصعّب Chat/Enrollments. |
| **البيانات التعليمية المشتركة (Courses, CourseOpening)** | مرتبطان بالطالب والمدرس والإدارة. يبقىان في DB مشترك مع حدود وصول صارمة على مستوى الـAPI/Service. |
| **الجداول المشتركة (Enrollments, Certificates, Reviews, Chat)** | روابط مباشرة. الحل: **فصل الـAPIs** (Learner API vs Admin API) + **Server-side authorization صارم** داخل كل service، وليس نقل الجداول. |

**الخلاصة**: **نقسم الـBoundaries (Code + Routes + Permissions + Network exposure)**، **ولا نقسم الـSchema/DB الآن**. هذا يحقق "عزل أمني حقيقي" بدون كسر العلاقات.

## 5. كيف ستتم المصادقة؟

**اقتراح: مصادقة موحدة (Central Identity) مع فصل نطاقات الوصول**

- **نفس Auth Service** (JWT موحّد). التوكن يحمل `sub`, `role`, `permissions` (مستحسن RBAC+Permissions)، `tokenVersion`, `aud` (audience).
- **Audience/Scopes**: نميز نوع الجلسة (`aud: 'learner' | 'admin'`) لتقييد الاستخدام (توكن admin لا يُستخدم بسهولة على learner frontend).
- **Refresh Tokens**: فصل مسارات الجلسات الإدارية عن العادية. جلسات إدارية أقصر + تخزين أكثر صرامة (httpOnly, Secure, SameSite, rotation + reuse detection). يمكن استخدام **separate refresh token family** للإدارة.
- **MFA للإدارة**: مطلوب لـ `ADMIN`, `FINANCE` (خصوصًا SUPER_ADMIN مستقبلًا). يمكن تفعيله عند تسجيل دخول إداري أو step-up auth للعمليات الحساسة (payments/refunds/audit).
- **Step-up Authentication**: للعمليات المالية/حساسة (approve refund، revoke certificate، delete audit-related ops) نطلب إعادة مصادقة أو TOTP مؤقت.

**ملاحظة مهمة**: فصل Frontends إلى دومينين مختلفين (`app.example.com` learner، `admin.example.com` admin) + **CORS صارم** (learner origin لا يُسمح له باستدعاء `/api/admin/*` والعكس).

## 6. فصل APIs (Routes/Controllers/Services/Permissions)

أقترح **فصل منطقي + فصل مسارات URL**:

| النظام | Base Path | النطاق |
|---|---|---|
| Learner API | `/api/v1/*` (أو `/api/learner/*`) | طالب+مدرس |
| Admin API | `/api/admin/*` | إداري/مالي |

**الفصل على مستوى Module/Controller**:
- نقل Controllers الإدارية إلى مجلد/مسارات `admin/` (أو إنشاء `admin/` domain modules منفصلة).
- فصل Guards/Decorators للإدارة (يمكن استخدام `@AdminScope()` أو `RequirePermissions(...)`).
- **Server-side boundary enforcement**: middleware/guard يتحقق من `aud` + route prefix. حتى لو استخدم شخص توكن admin على `/api/...` learner routes، نرفضه أو نحدده.

**RBAC + Permissions دقيقة** (طلبك الأساسي):
- الانتقال من Role-only إلى **Permissions** (granular): مثال `payments:approve`, `refunds:review`, `users:delete`, `audit:read`, `audit:delete:deny` (حماية السجلات).
- فصل صلاحيات `SUPER_ADMIN/ADMIN/FINANCE/COURSE_MANAGER` (each least privilege).
- **Ownership checks إلزامية**: في كل Resource (BOLA/IDOR prevention). Service layer يتحقق `resource.ownerId === userId` أو صلاحية إدارة.

## 7. كيف سيصل كل نظام للبيانات؟

- **نفس Prisma Client** (واحد). الوصول عبر Services فقط (لا controllers مباشرة DB).
- **Data access policies داخل Services**: كل service يتحقق الدور/Permissions + Scope (learner scope = own data + taught courses فقط). 
- **Row-level discipline**: مثلاً Learner API لا يستعلم `AuditLog`، `Payment` كامل إلا ما يخصه (own)، `Operations` مطلقًا.
- **Cross-boundary calls ممنوعة**: Learner services لا تستدعي Admin services والعكس (منع تسرب الامتيازات). استخدم boundaries واضحة.

## 8. المخاطر المحتملة (Risks) وكيف نمنعها

| خطر | شرح | Mitigation |
|---|---|---|
| **Privilege Escalation** | دمج Guards أو خطأ في تعيين Roles بعد الفصل | Guards منفصلة + unit/integration tests لكل boundary + route prefix enforcement (aud + path) |
| **IDOR/BOLA** | الوصول لمورد لا يخص المستخدم | Authorization في **كل method** (Service-layer) + ownership checks + resource-based policies + fail-closed |
| **Broken Access Control** | ترك endpoint مختلط أو نسيان @Roles | Route segregation + deny-by-default + lint rule (منع admin decorators في learner modules) |
| **Auth Bypass/JWT vulns** | الاعتماد على role فقط من Frontend | Server-side فقط. تجاهل أي ادعاء من client. التحقق من `tokenVersion`, issuer, aud. Step-up للعمليات الحساسة. |
| **Admin endpoint exposure** | Learner frontend يصل Admin API بطريق الخطأ | CORS صارم (origins منفصلة)، Network split (اختياري)، و**route guards حسب origin+aud**. عدم تسجيل admin routes في learner swagger. |
| **CORS/Cookie misconfig** | CSRF إذا استخدم cookies | إذا cookies (httpOnly): SameSite=strict/lax حسب حاجة، Secure، __Host-، CORS whitelist صارم، CSRF tokens للـadmin browser flows. مع Bearer tokens أقل عرضة CSRF. |
| **Data leakage** | أخطاء API تعيد includes كثيرة أو expose PII | DTOs صارمة، `select`/projections، strip sensitive fields، error messages عامة (لا تكشف DB details). |
| **DB split premature** | duplication/sync مشاكل | **عدم التقسيم الآن**. يبقى واحد مع boundaries قوية. التقسيم لاحقًا فقط عند ضرورة compliance/scale واضحة. |
| **Chat/Relations broken** | Student–Instructor يفقدان الربط | يبقىان في نفس الهوية+DB. الفصل المنطقي فقط. |
| **Performance regression** | N+1 أو includes زائدة بعد فصل | يظل Prisma كما هو، الفرق فقط في authorization checks. |

## 9. الخطة التدريجية (Incremental) — بدون كسر الوظائف

**أولوية التنفيذ: Security > Correct AuthZ > Data Isolation > Stability**.

| الخطوة | ماذا تفعل | الغرض | مخاطرة |
|---|---|---|---|
| **0. تحليل العلاقات (مكتمل جزئيًا)** | توثيق جميع cross-references (FKs + service imports + mixed controllers) — جدول مرجعي كامل | منع كسر العلاقات | منخفض |
| **1. Boundary Map + Decision Doc** | توثيق دقيق: أي module يذهب أين + Shared + Exceptions. **أعرضه لك للموافقة قبل التنفيذ** | تجنب الرجوع للخلف | منخفض |
| **2. Permission Model (RBAC+Permissions)** | إضافة نظام Permissions دقيق + `RequirePermissions` decorator + Policy layer | Least Privilege + منع BOLA | منخفض |
| **3. Route Segregation** | فصل Admin routes تحت `/api/admin/*` + Learner تحت `/api/*` أو `/api/v1/*`. إضافة Admin API module منفصل | فصل التعرض (API exposure) | منخفض |
| **4. Harden Guards** | إضافة `aud` (audience) + route-prefix guard + deny-by-default + ownership checks في Services | منع الوصول بين النظامين حتى لو توكن مسروق | منخفض–متوسط |
| **5. DTOs + Projections** | تقليص exposes، منع تسرب بيانات إدارية | Data Leakage | منخفض |
| **6. MFA + Admin Session Hardening** | MFA للـAdmin/Finance، step-up للعمليات الحساسة، refresh token isolation | أمان أعلى للجلسات الإدارية | منخفض |
| **7. Audit 강화** | حماية AuditLog (no delete/update من non-super)، تسجيل كل ops إداري/مالي | Compliance/forensics | منخفض |
| **8. Tests (critical)** | AC tests: learner يحاول `/api/admin/*` → 403/404، IDOR tests، privilege escalation tests | إثبات العزل | منخفض |
| **9. Frontend split prep** | CORS/origins منفصلة، منع admin calls من learner origin | فصل فعلي على مستوى النطاق | منخفض |

## 10. التوصية النهائية

- **نقسم منطقيًا (code/routes/authZ)**، **نبقى بDB واحد** الآن. هذا يحقق **عزل أمني حقيقي** (ما طلبته: Backend/API/AuthZ/Permissions منفصلة، وعدم الاعتماد على Frontend) بدون كسر العلاقات الطبيعية Student–Instructor.
- **لا أوصي بـDB split الآن** — مخاطرة عالية، فائدة غير مؤكدة بدون متطلب قانوني واضح. يمكن النظر له لاحقًا (Stage 4) إذا لزم الأمر.
- **أبسط وأأمن مسار**: فصل المسارات + Guards + Permissions + CORS + deny-by-default، مع DB مشترك.

**الخلاصة**: الفكرة **ممتازة**، والخطة **مدروسة وتدريجية**. العيب الرئيسي إن **التنفيذ دفعة واحدة خطير**، أما **تدريجيًا بدون كسر الوظائف** فهو **ممكن وقابل للتطبيق بأمان**.

**أطلب موافقتك على هذا التحليل + الخطة قبل البدء بأي تنفيذ.**