# Academy Platform Implementation and Deployment Audit

## Implemented architecture

- Express/MongoDB API with JWT roles for student, teacher, admin, and superadmin.
- Responsive React/Vite public website and protected operations portal.
- Responsive React Native Android student app with phone/tablet layouts and English/Marathi UI.
- Additive normalized collections: `Transaction`, `Enrollment`, `StudentDevice`, `AuditLog`, `SyllabusUnit`, `LearningFile`, `QuestionImport`, `Question`, and `QuestionAttempt`.
- Historical `Content` and `AcademyRecord` collections are retained for backward compatibility.

## Implemented requirements

- Achievement image/video upload, update preview, website wall, and Android rendering.
- Course image preview, responsive course catalog/detail/purchase UI, server-owned discounts, actual/payable price and offer text.
- Full-screen image/video splash behavior with video capped at five seconds and image duration of two seconds.
- Scheduled splash media is validated by type, previewed before upload, available to Admin and Super Admin, and soft-deleted; expired schedules are never returned as active.
- Student purchase verification, transaction details, device UUID, automatic validity, manual validity override history, and read-only identity fields.
- Teacher profile and subject assignment management with duplicate email/mobile checks.
- Multiple payment accounts with per-course accepted/default account selection.
- Unified subject workspace for syllabus, PDF/DOC/DOCX learning files, XLSX question preview/import, question attempts, and scoring.
- Android authenticated Learning and Online Exam screens protected by active enrollment dates.
- Admin-issued one-time student passwords with required reason, session revocation, and immutable audit log entry.
- Password-plus-email-OTP student login on Android and web, single active session rotation, and automatic access denial after course validity expires.
- Student Home, Courses, Syllabus, Notes, Papers, Tests, Lectures, and Profile/Payments navigation on Android and web.
- Server-generated purchase tracking IDs and emailed PDF receipts containing verified payment, course, and validity details.
- Verified-purchase dashboard and reports for 7 days, 30 days, and 12 months, including course demand, revenue, discounts, and CSV export.

## Compatibility and preservation rules

- `Course.fees` remains the payable INR price for existing clients.
- Existing API routes remain mounted; legacy notes/material records are not deleted.
- Purchase submissions remain `pending` until admin/superadmin verification. Client-submitted payment data never activates enrollment by itself.
- Migration scripts are idempotent and dry-run by default. Applying a migration requires an explicit `--apply` script.
- Plaintext temporary passwords are returned only in the immediate issue/verification response and are never written to audit logs.

## Pre-deployment checks

From `Backend`:

```sh
npm run lint
npm test -- --watchman=false
npm run migrate:academy:check
npm run migrate:learning-files:check
```

From `Frontend`:

```sh
npm run build
```

From `ShahuAPP`:

```sh
npx tsc --noEmit
cd android && ./gradlew :app:compileDebugKotlin
```

Review migration summaries and database backups before applying:

```sh
npm run migrate:academy:apply
npm run migrate:learning-files:apply
```

The academy migration backfills missing course pricing, normalized historical transactions, and enrollments for successful purchases that already have a matching student. Successful legacy purchases without a matching student are counted for manual review and are not used to create an identity automatically.

## External configuration still required for production

- Set production MongoDB/JWT/CORS/upload origins and Android API origin through the deployment environment/build configuration.
- Configure a real payment-provider webhook and signature secret before automatic payment confirmation.
- Configure SMS/email delivery if student credentials or OTP login are to be delivered automatically.
- Run migrations first against a staging copy of production data and retain a database backup.
