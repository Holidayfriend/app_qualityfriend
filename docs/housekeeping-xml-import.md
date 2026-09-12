# Housekeeping XML imports and notifications

## Running the feature

This project's local app, PostgreSQL, and worker run in Docker Compose. Review and apply `prisma/migrations/20260912130000_add_import_notifications/migration.sql` using your normal migration workflow. No migration commands or live imports were executed during implementation.

After adding the XML parser dependency, update both separate dependency volumes and start the worker from the project directory:

```powershell
docker compose stop worker
docker compose build app worker
docker compose run --rm --no-deps worker npm ci
docker compose exec app npm ci
docker compose exec app npx prisma generate
docker compose restart app
docker compose up -d worker
docker compose logs -f worker
```

For later handler-only changes, use `docker compose restart worker`. Do not start a second worker on the Windows host. Both containers bind-mount the project at `/app`, so the worker reads the same `public/ASA` files as the app. See [background jobs](background-jobs.md) for the full Docker setup.

Set the hotel's **Houskeeping ASA XML** name in Account Settings. For `Qualityfriend`, the server reads `public/ASA/Qualityfriend.xml`. Refresh checks the setting/file, commits a queue job and dispatch audit record together, and shows a dispatched toast only after that transaction succeeds. A pending/active job for that hotel prevents duplicate dispatch.

Refresh uses the existing Housekeeping module access rule, including the administrator bypass. It does not require an additional update, assignment, or ALL-scope permission. The worker rechecks hotel/user activity, subscription eligibility, module visibility, and the configured filename before writing. Tenant identity comes from the session and is retained in the job payload; the browser cannot select another hotel or filename.

The worker imports the file in a database transaction and saves completion audit data and a notification in that same transaction. Retry attempts are logged; final failures create a failure notification. A dead-letter handler also records terminal queue failures/timeouts. The worker must be running to process queued jobs and terminal-failure notifications. Normal jobs retry twice with backoff.

## XML mapping

The parser follows the old root `read_xml.php` and the available `Zimmerreservierungen` export:

- `Nummer` and `Name` create rooms and categories when missing. Existing room configuration and housekeeping cleanliness/service flags are preserved. The export contains no floor information; imported rooms retain existing floors or remain unassigned to a floor. It does not invent a physical floor.
- `Anreise`, `Abreise`, `Status`, `Verpflegung`, `BookingGroup`, `Offer` map to reservation/stay facts. `occupied`, `reserved`, `departed`, and `roomFixed` are supported as in the old project. `cancelled` is also recorded; request/unsupported statuses are counted as skipped. No actual check-in/out timestamp is invented from a status string.
- Adult totals use `AnzahlErwachsene` when present, otherwise `ZSB + Erw.` when supplied. Missing counts remain null. Child counts/bands remain separate.
- `Zimmergast` stores each guest's own name, birth date, language, VIP flag, and previous-stay count. It does not copy the last guest's language/VIP onto everyone.
- Service notes and `VonZimmerreservierung`/`NachZimmerreservierung` room references are preserved.

Malformed XML, invalid dates/counts, custom entities/DOCTYPE, ambiguous duplicate room/date keys, oversized files, and invalid paths fail the import before any reservation changes commit. Files are bounded to 20 MB and exports to 10,000 reservation entries. Supported XML encodings are decoded using the declaration.

## Identity and freshness limitations

The available XML has no stable reservation or guest IDs. A deterministic room + arrival + departure key makes identical imports update existing records. If those dates change, a new record is created and the previous record remains historical. Guest keys use name/birth-date plus an occurrence discriminator. These are import matching keys, not verified PMS identifiers.

`source_present` identifies records in the latest successfully imported ASA snapshot for the hotel. Missing reservations are marked absent rather than deleted, and their last-seen time remains intact. Operational queries must filter this field and appropriate statuses; an absent record is not automatically a confirmed cancellation. Changing the configured source also replaces ASA snapshot membership without deleting older history. Empty valid exports clear current membership.

Room-move references are retained but do not prove a single booking identity. Future departure metrics must account for them and must not blindly count every room segment as a hotel departure. Cleaning state is never reset merely because the XML is imported.

Import runs record read/created/updated/skipped counts and checksum. `records_rejected` currently contains the count of unsupported status records skipped. Created/updated counts refer to reservation records, not all database rows. Guest removals affect only the imported guest list for a matched stay; manually maintained guest rows are left alone.

## Shared notification service

`lib/notifications/service.ts` exposes `createNotification(client, input)` to trusted server and worker services. Use the transaction that completes the business action. Supply hotel, recipient, module key, a stable event key, icon key, internal destination, and English/German/Italian title/body text. A unique tenant + recipient + event key prevents duplicate messages on retries.

Each row stores all three translations. `GET /api/notifications?locale=en|de|it` returns only the requested language for the signed-in recipient and accessible modules. The existing bell polls every five seconds while visible, displays unread state, and navigates to the stored internal destination on click. Acknowledgement updates only that recipient's record. Import notifications link to `/housekeeping` and use the housekeeping broom icon.

Current import notifications go to the user who requested the import. Future modules can create their own notifications or explicitly fan out to multiple authorized recipients. `requiredScope` is optional infrastructure for future broad-scope notifications; Housekeeping import receipts use the default recipient-specific scope and add no ALL-scope requirement.

The dropdown preserves its existing layout while replacing sample entries with persisted notifications. Other existing module screens have not been converted to the notification service. The housekeeping board still uses its existing preview data; this change imports backend records and adds notifications, not a board-data rewrite.

## Deployment and verification

`proxy.ts` blocks direct requests to the ASA directory through Next.js because these files contain guest data. A reverse proxy or static file server must not independently publish that directory; the worker and app need filesystem access to the same import directory. No guest values are included in application failure logs.

Automated checks cover XML mapping/validation, repeat-key behavior, authorization and origin guards, retry idempotency, notification contracts, rollback paths, and local file preflight. Worker/database tests use controlled stubs; they are not an end-to-end PostgreSQL import test. The local XML was parsed read-only, producing 187 entries: 109 supported and 78 requests skipped. No live import or migration was run.
