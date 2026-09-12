# Competitor refresh backend

The UI is unchanged. This ports the data flow from `hotel_monitor_mysql.php`
and `get_address.php`; Xotelo supplies the hotel list and Nominatim supplies
addresses. The old `api_key` field is a provider hotel identifier, stored here
as `external_key`, not an API credential.

## Tables

`competitors` contains the account ID, saved Tripadvisor location key, external
hotel key, name, accommodation type, URL, rating, review count, minimum/maximum
prices, coordinates, image, mentions, merchandising labels, hotel address,
original JSON response and timestamps. Prices retain the provider's numeric
values; this endpoint does not invent a currency when the API omits one.

Rows are unique by `(hotel_tenant_id, location_key, external_key)`. Refreshing
updates the existing row; different accounts cannot overwrite each other's data.
Missing numeric values remain null. Changed coordinates invalidate the address.
Older rows are retained if a later API response omits them; `last_fetched_at`
shows their freshness. Changing the account's Tripadvisor ID selects a different
location's records. An old queued job is skipped if that setting changes.

`competitor_address_cache` caches reverse lookups across accounts, including
no-result responses. It also records request times to enforce provider limits
across worker processes. Failed lookups can retry without discarding hotel data.
Queue state is stored in pg-boss's `pgboss` schema.

## Authenticated endpoints

All endpoints require an active user, active hotel/subscription, and access to
the competitors module. The account comes from the session, never the request body.

| Method and path | Behavior |
| --- | --- |
| `POST /api/competitors/refresh` | Dispatch using the account's saved Tripadvisor ID; returns HTTP 202 with `jobId` and `statusUrl`. |
| `GET /api/competitors/refresh?jobId=UUID` | Read that account's job state and completion counts. |
| `GET /api/competitors?page=1&limit=50` | Review stored records, including raw payloads; limit is capped at 100. |

Missing IDs return 400, duplicate queued/running refreshes return 409, and queue
outages return 503. Job IDs belonging to other accounts return 404.

Before wiring a UI button, dispatch from the browser console while logged in:

```js
const response = await fetch('/api/competitors/refresh', { method: 'POST' });
const job = await response.json();
console.log(job);
// Later, if dispatch succeeded:
console.log(await fetch(job.statusUrl).then(response => response.json()));
console.log(await fetch('/api/competitors?limit=20').then(response => response.json()));
```

Backend-only local administration can dispatch without opening a browser:

```bash
docker compose exec worker npm run competitors:refresh -- HOTEL_TENANT_UUID
```

This trusted CLI bypasses session authorization; do not expose it as a public API.

## Processing and deployment

Run the additive Prisma migration, regenerate the app client, then restart the
app and recreate the worker with its updated environment:

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma generate
docker compose restart app
docker compose up -d worker
docker compose restart worker
```

Xotelo requests use `sort=best_value`, pages of 50, and a maximum of 2500 hotels,
matching the PHP importer. All pages must succeed before database changes are
committed. Upserts are transactional. The completion result reports whether the
cap was reached. Jobs retry failed requests up to three times with backoff.

Addresses run in a separate queue after hotel data is saved. A completed refresh
does not mean all addresses are ready. `missingAddresses` in the review API
includes pending, failed and unresolvable addresses. Use worker logs and pg-boss
job states to distinguish failures. The public Nominatim service is cached,
serialized, and limited to four requests per minute. Keep public-service address
processing on one worker machine. At 2500 uncached hotels, address enrichment can
take over ten hours. Do not use the public endpoint for large recurring imports;
configure a suitable Nominatim-compatible provider with `NOMINATIM_BASE_URL` and
set `NOMINATIM_USER_AGENT` to identify your application/contact. See the
[Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).
Any future UI displaying these addresses must show OpenStreetMap attribution.

On the VPS, use the worker deployment described in [background jobs](background-jobs.md),
pass the Nominatim variables to that worker, and apply this migration before
starting the new app/worker release. No cron is needed.

## Tests

Live verification on 2026-09-12 reached Xotelo, but `/list` returned HTTP 200
with an API error: `Failed to fetch list data, please check your params and try again.`
This occurred for both the saved `g1493734` location and the provider's documented
`g293916` example, including default pagination parameters. No live competitor
records were inserted. A successful live provider response is still needed for
data approval; fixture-based integration tests do not establish live data accuracy.

```bash
npm run test:competitors
docker compose exec -e RUN_COMPETITOR_DB_TESTS=1 worker npm run test:competitors
```

The integration test creates and removes its own temporary PostgreSQL schema.
It uses mock provider responses, never calls external APIs, and verifies stable
upserts, tenant isolation, all-or-nothing writes, stale job handling, coordinate
changes and address caching.
