# Merge notes — backend

Base tree: friends' `lms backend 20 7 2026` (most current — has ai-tutor, gradebook,
attendance, announcements, resources, quizzes split into quizzes/questions/attempts).

Overlaid on top of that base, from your `backend-notification-fix` branch, because
these were empty stubs (`// code here`) or entirely missing on the friends' side:

| File | Why |
|---|---|
| `src/api/admin/*` (controller, routes, service) | Friends' `admin.controller.js` / `admin.service.js` are 1-line placeholder stubs. Yours (264 lines) is the only real implementation, and it's exactly what `useAdmin.ts` on the frontend calls. |
| `src/api/events/notification.events.js` + `notification.listners.js` | The event bus itself. Didn't exist on friends' side at all. |
| `src/api/notifications/*` | Yours has live Socket.IO push (`emitToUser`) built into `create`/`createMany`; friends' is plain DB CRUD with no push and a different response shape (`notifications` key instead of `items`). Your frontend's `useNotifications.ts` expects `items` + a push event, so yours had to win. Also added the `delete` and `test` endpoints, which only exist in your version. |
| `src/sockets/index.js` | Friends' file is an empty stub. Yours is the full Socket.IO server (JWT-authenticated, room-per-user). |
| `src/server.js` | Needed to create an `http.Server` and call `initSocket()` — friends' version just does `app.listen()` with no socket support. |
| `src/config/database.js` | Yours adds a Prisma Client Extension that auto-fires `ENROLLMENT_CREATED` on `enrollment.create`/`upsert`. Friends' has no such hook. |

Everything else (quizzes, assignments, users, courses, upload/validate middleware,
ai-tutor, gradebook, attendance, resources, announcements) came from **friends'**
side unchanged — in several of those, your branch actually had the placeholder
(`quizzes.controller.js`, `quizzes.service.js`, `assignments.controller.js`,
`assignments.service.js`, `assignments.validation.js`, `middleware/validate.middleware.js`
were all stubs in your branch), so friends' real implementations were kept as-is.

## Schema changes
- Base: friends' `schema.prisma` (has `AiDocument`/`AiDocumentChunk`, cleaner
  `Announcement`/`AttendanceRecord`/`Resource` models with proper `@default(uuid())`).
- Added: `ParentStudentLink` model + `User.parentLinks`/`User.studentLinks` relations —
  this existed only in your schema and nowhere in friends'. No conflicts; it's a
  net-new model, table `parent_student_links`.
- Note: no controller/service on either side currently reads/writes
  `ParentStudentLink` — it's schema-only groundwork for the parent-portal pages
  that already exist in the frontend (`pages/parent/*`) but still run on mock data.

## app.js
Hand-merged: kept every friends' route registration (ai-tutor, gradebook,
announcements, resources via courses.routes, quizzes/attempts/questions, payments)
and added `app.use('/api/v1/admin', adminRoutes)` plus the
`registerNotificationListeners()` boot call your notification system needs.

## Verified
- Every `.js` file passes `node --check` (syntax-clean).
- `prisma/schema.prisma` brace-balanced, `ParentStudentLink` wired both directions.
- `require('./src/app.js')` resolves every module cleanly. The only failure when
  smoke-testing was `@prisma/client did not initialize yet` — that's this sandbox's
  network policy blocking the Prisma engine binary download during `npm install`,
  not a merge defect. Run `npm install` (which runs `prisma generate` automatically)
  on your own machine and it'll be fine.

## Things worth double-checking on your end
- `notification.listners.js` passes `link` and `meta` fields into
  `NotificationService.create(...)`, but the `Notification` model has no `link`/`meta`
  columns — they're silently dropped right now (no crash, just not persisted). If you
  want notifications to deep-link somewhere when clicked, add
  `link String?` and `meta Json?` to the `Notification` model and a migration.
- Run `npx prisma migrate dev` after merging — the schema changed (new
  `parent_student_links` table) and needs a migration generated against your actual
  database.
