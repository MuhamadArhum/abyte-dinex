# Security Considerations

This document lists the production security expectations for Abyte Dinex, plus known, accepted risks and their rationale. It is not a general security tutorial — it assumes familiarity with the codebase (see `CLAUDE.md`).

## Secrets

- `JWT_SECRET`, `DB_PASSWORD`, `ENCRYPTION_KEY`, `GROQ_API_KEY`, `EMAIL_PASS`, and any Google Drive service-account JSON live only in `main-app/backend/.env` (gitignored) or your deployment platform's secret store. None of these are committed to git — verify with `git ls-files | grep -i env` before any release that only `.env.example` files are tracked.
- The frontend build only reads `VITE_API_URL`. Never prefix a secret with `VITE_` — Vite inlines every `VITE_*` variable into the client-visible JS bundle at build time.
- `services/cryptoService.js` encrypts sensitive stored values (AES-256-GCM) using `ENCRYPTION_KEY`, falling back to deriving a key from `JWT_SECRET` if unset. Set `ENCRYPTION_KEY` explicitly in production so encryption doesn't silently depend on a secret used for a different purpose.
- Backup/restore passes the DB password via the `MYSQL_PWD` environment variable to the spawned `mariadb-dump`/`mysql` process, not as a `-p<password>` CLI argument — this avoids it being visible to other local users via the process list.

## Authentication & sessions

- JWTs are signed HS256, carry only `{ user_id, username, role_name }` (no sensitive data), and expire per `JWT_EXPIRES_IN` (default 8h).
- Logout blacklists the presenting token in a DB-backed table (`token_blacklist`), checked on every authenticated request; the blacklist fails **closed** (denies the request) if the DB check itself errors, to avoid a DB outage silently letting revoked tokens through.
- Changing or resetting a password invalidates **every** previously issued token for that user (via `users.password_changed_at` checked against the JWT's `iat`), not just the one used to make the change.
- There is no self-service sign-up. Rate limits: 10 login attempts / 15 min per IP, 5 password-reset requests / 15 min per IP.

## Authorization

- Every sensitive backend route is gated by `requirePermission(moduleKey)` (DB-backed `role_permissions` table) or `authorize('Admin')`, independent of any frontend guard. If you add a new endpoint that returns business data (sales figures, customer PII, financial totals), gate it — do not rely on the frontend hiding the button.
- **Do not treat HTTP method alone as a proxy for read vs. write.** `requirePermission` auto-maps `POST/PUT/PATCH/DELETE` to `.create/.update/.delete` permission sub-keys. If an endpoint is a POST for request-shape reasons only (e.g. it has a body) but is semantically a *read* — like the AI chat endpoint — use `requirePermission(key, { asView: true })` to check the base permission key instead, or you'll silently require a permission (`x.create`) that no legitimate viewer role actually has.
- The AI assistant (`POST /api/ai/chat`) requires the `system.ai_widget` permission, matching the frontend widget's own visibility check (`AIWidget.tsx`). Its context deliberately excludes staff account details (names/emails/roles) — if you extend the AI context to include new data, apply the same "would this be visible to this role anywhere else in the app?" test before adding it.

## Database & backups

- Schema changes go through numbered migrations (`services/migrationService.js`), never ad hoc `ALTER TABLE` in a controller.
- `/api/backup` routes are Admin-only (`requirePermission('system.backup')`) and validate every filename against a strict `^[\w\-]+\.sql$` pattern with path-containment checks before touching the filesystem, at both the route layer and inside `services/backupService.js` — defense in depth, not either/or.
- A pre-restore backup is taken automatically before any restore operation.

## File uploads

- Logo/image uploads are size-capped (2MB) and MIME-type-restricted (`image/png|jpeg|jpg|gif|webp`) via `multer`'s `fileFilter`/`limits`.

## Known, accepted risks (documented, not oversights)

- **HSTS is disabled.** `server.js`'s Helmet config assumes a local LAN HTTP deployment. If you deploy this instance behind public HTTPS, re-enable HSTS — don't assume the current default is safe for your deployment target without checking.
- **JWTs are stored in `localStorage` on the frontend**, not an httpOnly cookie — standard for this class of SPA, but it means any future XSS is a full account-takeover primitive. The mitigating controls already in place (a strict CSP with no `unsafe-inline`/`unsafe-eval` for scripts, and no `dangerouslySetInnerHTML` anywhere in the frontend) must be preserved by anyone adding new frontend code — don't introduce raw HTML rendering of user-supplied content.
- **No per-branch or per-user data isolation.** This is a single-tenant app; `branch_id` columns exist on several tables as leftovers from an earlier design but have no enforcing application logic. Authorization is role-based (what a role can see/do), not row-level/ownership-based. Don't assume "user A can't see user B's records" holds anywhere except where a specific role permission gates it.

## Dependency hygiene

Run `npm audit` on both `main-app/backend` and `main-app/frontend` before any release and address anything in production dependencies. As of the last review, both were clean (0 vulnerabilities in production dependencies); a couple of dev-only build-tooling advisories (`vitest`/`sharp`) were left unresolved because fixing them requires a breaking native-module upgrade for tools that never process untrusted input and never ship to users — re-evaluate that tradeoff periodically, not as a permanent exemption.
