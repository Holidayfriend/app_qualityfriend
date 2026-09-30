# Background jobs

Jobs use pg-boss and the existing PostgreSQL database. Its tables live in the
separate `pgboss` schema, initialized automatically on startup. No Redis or host
cron is required. The worker enables pg-boss scheduling so `weather-daily` runs
at 06:00 and 14:00 UTC. The database user must be allowed to create that schema
and tables. The PostgreSQL Docker volume persists queued jobs across container
restarts.

## Local Docker

First setup (and after dependency changes):

```bash
docker compose build app worker
docker compose run --rm --no-deps worker npm ci
docker compose exec app npm ci
docker compose up -d worker
```

The existing app and worker have separate node_modules volumes; rebuilding an
image does not update an existing dependency volume, hence the install commands.
After initial setup, `docker compose up -d` starts the worker with the other services.

```bash
docker compose logs -f worker
docker compose exec worker npm run jobs:smoke
docker compose exec worker npm run weather:daily
docker compose exec app npm run ai_recomendation:daily
```

`weather:daily` geocodes each active hotel address (once, then reused), fetches
Open-Meteo weather, and upserts `hotel_weather`. The dashboard reads that row
only. The same job also runs from the worker schedule at 06:00 and 14:00 UTC.

`ai_recomendation:daily` writes one AI recommendation row per hotel and place
into `hotel_ai_recommendations` (EN/DE/IT). Today only `RECRUITING` is generated
(from live jobs, applications, scores, and offers). `DASHBOARD` is reserved for
the same job later. The recruiting hub banner reads the recruiting row. The
worker also runs this job at 06:00 UTC.

The smoke command queues a harmless job and waits up to 45 seconds for the
separate worker to finish it. Use `-- --dispatch-only` to queue without waiting,
then `-- --id=JOB_ID` to verify that same job later (for example, after restarting
the worker).
Restart the worker after editing handlers: `docker compose restart worker`.

Without Docker, run `npm run worker` in a separate terminal with DATABASE_URL
configured in `.env`. The app and worker must connect to the same database.

## Dispatching and adding jobs

From trusted server code (a route handler or server action), after checking
authentication and permissions:

```ts
import { dispatchSmokeJob } from "@/lib/jobs/queue";

const jobId = await dispatchSmokeJob({ message: "Hello from the app" });
```

Do not import the queue in a client component. A browser should call an
authenticated API route which dispatches the job. No public test endpoint is added.

For a real job, add its queue and payload type in `lib/jobs/queue.ts`, initialize
the queue in `initializeQueues`, and register its handler in `scripts/worker.ts`.
Keep tenant IDs in job payloads and enforce tenant ownership when dispatching
and exposing job status. Pass IDs rather than passwords or large data objects.
The worker is a plain Node process: Next.js request helpers and modules importing
`server-only` (including `lib/prisma.ts`) cannot be used directly. For database
access, use a separate worker-compatible Prisma client or a PostgreSQL connection.

The example queue retries failures three times with backoff, expires active jobs
after five minutes, and retains completed jobs for seven days. Throw errors from
handlers to trigger retries. Jobs can execute again after failures or crashes;
make business operations safe to repeat, and give outbound API calls timeouts.
Inspect status with `boss.findJobs(queueName, { id: jobId })` from server code.

## VPS deployment

The checked-in Dockerfile and Compose file are for local development. In your
production Compose configuration, add a worker service using the same release
image as the app with:

```yaml
worker:
  image: your-qualityfriend-release-image
  command: ["./node_modules/.bin/tsx", "scripts/worker.ts"]
  init: true
  restart: unless-stopped
  stop_grace_period: 45s
  environment:
    NODE_ENV: production
    DATABASE_URL: ${DATABASE_URL}
```

Use Node >=22.12.0. Include `scripts/`, `lib/jobs/`, and runtime dependencies
(`pg-boss`, `tsx`, `dotenv`) in the release image; a Next.js standalone output
alone does not include these worker files automatically. Connect the worker to
the production database network and supply any API credentials its handlers need.
Do not use local source/dependency bind mounts in production. Start/update the
worker with the app on every deployment. Docker sends SIGTERM on shutdown; the
worker waits up to 30 seconds for active work, then unfinished jobs can be retried.

## Scheduled ASA XML imports

After deploying these changes, restart the worker so it supports system imports.
Queue imports for all active hotels with ACTIVE/COMPED subscriptions:

```bash
docker compose exec -T worker npm run housekeeping:import
```

Hotels without an ASA XML filename are skipped. Invalid filenames are reported as
failures. An optional hotel UUID limits the command to that hotel:

```bash
docker compose exec -T worker npm run housekeeping:import -- HOTEL_UUID
```

For every two hours, add this to the server user's crontab (replace the project
path; that user must have Docker access):

```cron
0 */2 * * * cd /path/to/app_qualityfriend && docker compose exec -T worker npm run housekeeping:import >> /path/to/app_qualityfriend/housekeeping-import.log 2>&1
```

This uses the server's cron timezone. Keep the worker running. The command queues
imports and exits; it does not wait for XML downloads to finish. It reports each
hotel and totals, continues if one dispatch fails, and exits nonzero for dispatch
failures. Already queued/running imports are skipped using the existing queue's
per-hotel singleton protection. Worker failures use existing retries and import
run records. Check completion with `docker compose logs --since 2h worker`.

System imports retain audit/import-run records with no user actor and do not send
user notifications. Hotel eligibility and XML settings are checked again by the
worker. Manual Refresh keeps its user permission checks and notifications.

This command imports reservation and guest data only; it does not invoke
`housekeeping:daily` or reset cleaning status/checklist ticks. If generating a
morning plan, wait for the XML import to succeed before running the daily command.
