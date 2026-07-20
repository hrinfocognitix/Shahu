# Academy Platform Operations

## Environment

Backend production variables:

- `NODE_ENV=production`
- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN`
- `CLIENT_ORIGIN`
- `PORT` and optional `API_VERSION`
- SMTP, Firebase, Razorpay, and Twilio variables only when those integrations are enabled.

SMTP is required for student login OTPs and verified-purchase PDF receipts. Student login fails safely with HTTP 503 when email delivery is not configured.

Frontend uses `VITE_API_BASE_URL`, for example `https://api.academy.example/api/v1`.

Android API origin is a Gradle property:

```sh
cd ShahuAPP
npm run android -- --extra-params "-PACADEMY_API_ORIGIN=https://api.academy.example"
```

For a local emulator the default is `http://10.0.2.2:5001`. For a physical development device, pass the development computer's reachable LAN origin.

## Setup and verification

```sh
cd Backend && npm install && npm test -- --watchman=false
cd ../Frontend && npm install && npm run build
cd ../ShahuAPP && npm install && npx tsc --noEmit
```

Run `npm run lint` from `Backend` as an additional pre-deployment quality gate.

MongoDB payment verification uses transactions. Production MongoDB must be a replica set or managed cluster that supports transactions.

## Migration

Back up MongoDB, then run dry checks:

```sh
cd Backend
npm run migrate:academy:check
npm run migrate:learning-files:check
```

Review counts and unmatched successful purchases. Apply only after review:

```sh
npm run migrate:academy:apply
npm run migrate:learning-files:apply
```

Both migrations preserve original `AcademyRecord` and `Content` records and are safe to re-run.

## Main API surface

- `POST /api/v1/auth/login` — database login and JWT session.
- `POST /api/v1/auth/student/request-otp` and `/student/verify-otp` — registered-email OTP login for students.
- `GET /api/v1/courses` — public active course catalog.
- `GET /api/v1/course-purchases/:courseId/payment-options` — active accounts assigned to one course.
- `POST /api/v1/course-purchases` — idempotent pending Android purchase submission; requires `X-Client-Platform: android`.
- `PATCH /api/v1/course-purchases/transactions/:id/verify` — transactional admin verification.
- `GET /api/v1/course-purchases/students` and `GET /students/:id` — admin student commerce views.
- `GET /api/v1/course-purchases/me` — enrolled student profile, course validity, devices, tracking IDs, receipts, and payment history.
- `PATCH /api/v1/course-purchases/enrollments/:id/validity` — audited validity override.
- `POST /api/v1/course-purchases/students/:id/reset-password` — one-time temporary password.
- `GET|POST|PATCH /api/v1/learning/syllabus` — role/subject/enrollment protected syllabus.
- `GET|POST /api/v1/learning/files` — protected learning-file metadata/upload.
- `GET /api/v1/learning/files/:id/download?token=...` — ten-minute file-scoped download link.
- `GET /api/v1/learning/questions/template` — XLSX template.
- `POST /api/v1/learning/questions/preview` and `/import/:id` — validate/confirm import.
- `GET /api/v1/learning/questions` and `POST /questions/submit` — enrolled student attempts.
- `GET /api/v1/dashboard/purchases` — admin analytics with `period`, `from`, `to`, `course`, `student`, `paymentAccount`, and `status` filters.

## Manual QA checklist

1. Verify public website headings, course tiles, achievement image/video wall, and contact footer at 360 px, 768 px, and desktop widths.
2. Upload and update achievement image/video; confirm previews and website/Android playback.
3. Upload and update a course banner; confirm original/discount/payable price and validity on portal, website, and Android.
4. Test image and video splash on phone and tablet; confirm image is two seconds and video never exceeds five seconds.
5. Create two teachers; verify duplicate normalized email/mobile messages and assigned-subject restrictions.
6. Submit an Android purchase twice with the same transaction reference; verify only one pending transaction.
7. Mark a payment failed; confirm no enrollment. Verify a payment successfully; confirm transaction, enrollment, UUID, notification, and one-time credential.
8. Override validity with and without a reason; verify date validation and history.
9. Upload PDF/DOC/DOCX learning files and confirm direct `/uploads/*.pdf` access is denied while signed app/portal links work.
10. Upload the question template with valid, invalid, and duplicate rows; verify preview counts and confirmed import.
11. Log in as an enrolled and expired student; verify learning/question access is allowed/denied correctly and correct answers are absent before submission.
12. Verify Reports filters, charts, course/payment-account breakdowns, enrollment states, and CSV export.
13. Verify teacher cannot access finance/student transaction routes and student cannot retrieve another student's results/notifications.

## Deployment considerations and known external dependencies

- Configure a production payment gateway/webhook before automatic verification; manual admin verification remains the server-controlled workflow.
- Configure SMTP/SMS if temporary credentials must be delivered automatically.
- Configure Firebase credentials for push delivery; in-app notifications work without Firebase.
- Uploaded media currently uses the backend filesystem. Use durable object storage in horizontally scaled deployments.
- Run index creation and migrations on staging data first, then deploy during a controlled maintenance window.
