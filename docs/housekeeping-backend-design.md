# Housekeeping backend design

Shared architecture reference: [Internal AI Assistant — product-wide architecture](internal-ai-assistant.md). Read it when designing this or any new module; this document covers Housekeeping-specific requirements.

Status: proposal and source-code inventory, 2026-09-12. No application code, UI, database, or AI functionality changed. This is not a completed backend implementation or a live database audit.

## Scope and boundaries

Build the ordinary housekeeping backend first. Preserve every existing screen, control, label, layout, and mock AI behavior until explicitly authorized to change it. Backend endpoints can be implemented independently; connecting existing client components to them will require a separately authorized code change, even if the appearance stays identical. Missing data-entry controls are gaps to document, not permission to redesign the UI.

The agreed product name is **Internal AI Assistant**. It is a core, product-wide capability, separate from the existing external MCP integration. Housekeeping is its first use case, not its architectural boundary. Use separate internal services and, later, an internal tool registry. Do not overload external MCP hotel/user identifiers as internal entity identifiers.

## Product-wide Internal AI Assistant architecture

This requirement applies to all subsequent backend and database decisions:

- Keep shared assistant orchestration, provider access, tool registration, authorization context, execution logs, and document retrieval outside the housekeeping module. Each module exposes its own validated query and command services, reusable by ordinary APIs and assistant tools.
- Support housekeeping allocation/insights, job creation and prioritization, shift suggestions or authorized automatic scheduling, PDF/document understanding, dashboard summaries, revenue analysis, and future modules through the same shared architecture.
- Keep operational facts in their owning modules with stable IDs, tenant-scoped relationships, explicit dates, typed statuses, and traceable history. Cross-module workflows link those records rather than duplicating them in an AI-specific database.
- Derive hotel and user identity on the server. Enforce both tenant isolation and module/action/record permissions on every tool call, including cross-module workflows. Apply equivalent access boundaries to documents, extracted text, retrieval indexes, conversations, summaries, caches, and background jobs. A dashboard or assistant permission must not implicitly grant access to revenue or other restricted records.
- Distinguish queries, suggestions, and actions. Recommendations do not themselves change records. Future automatic actions require an explicit configured authorization policy and must use ordinary backend validation, conflict handling, idempotency, and audit records. User-requested automation need not require a confirmation for every action when already authorized by that policy.
- Retrieve documents through a shared, permission-aware document service with source/page references. Use document text as evidence, not instructions that override application permissions. Use authoritative operational queries for live counts and calculations.
- Compose dashboard insights and cross-module recommendations from authorized domain results, with source references, freshness, and missing-data indicators. Do not invent unavailable facts or expose restricted facts through a generated summary.

These are architecture requirements for future implementation, not authorization to build AI now. Implement the housekeeping backend first while preserving these shared boundaries and leaving the UI unchanged.

## Feasibility with the existing OpenAI integration

OpenAI function calling allows an application to expose named functions, execute model-requested calls in its own backend, and return their results for a final answer. This supports live operational questions without training a model on the database. Both Responses and Chat Completions support this pattern. Reference: [official OpenAI function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling).

Local evidence is narrower than end-to-end compatibility: `lib/mcp/client.ts` and `app/api/settings/mcp/route.ts` configure OpenAI credentials and a default model through the external provider service. Knowledge/vector-store and training routes also exist. The inspected local API code does not contain an internal housekeeping tool-execution loop. No live provider request or credential validation was performed.

A subsequent secret-safe check confirmed that `.env` also contains a populated `OPENAI_API_KEY`. The Internal AI Assistant can be designed with a direct server-side OpenAI adapter independent of the external MCP provider service. Key validity, billing access, and model availability have not been tested; the key must never be exposed to the browser or included in logs/documentation.

Consequently, the capability is feasible, but reuse of the exact current service requires verifying its inference endpoint, configured model, tool-call payload support, and server-side credential access. A separate internal provider adapter could reuse an authorized OpenAI account/configuration without sharing the external MCP tool registry. Do not retrieve or copy provider secrets into client code. A new MCP server is optional: application function tools can call the same internal services directly. If an internal MCP transport is wanted later, it can wrap those services.

Recommended flow: user/session -> internal assistant -> authorized domain query -> PostgreSQL -> structured facts -> model-written answer. Ordinary housekeeping API routes use the same domain query and command services. The database calculates counts; the model explains the results. Live room counts should not depend on vector search, fine-tuning, or stale conversation context.

## Source-code inventory

| Area | Evidence and current state |
| --- | --- |
| Persistence | `prisma/schema.prisma` uses PostgreSQL. Hotel tenants, users, departments, teams, role permissions, and audit logs exist. No housekeeping, reservation, handover, staff-shift, or absence models are defined there. HotelTenant has no time-zone field. Live database contents/drift have not been checked. |
| Housekeeping | `lib/housekeeping/preview-data.ts` supplies rooms, cleaners, categories, and extras. Arrival/departure values include strings such as `Today, checked out`. These are fixtures, not operational records. |
| Screens | `components/housekeeping/housekeeping-ui.tsx` contains local selection state, forms preventing submission, and mock AI allocation that changes DOM text. `settings-sections.tsx` also reads preview data. No housekeeping API routes were found. |
| Access | `lib/auth/module-access.ts` includes housekeeping/handovers permissions and a session-derived tenant. Its page-access helper checks viewing; commands need action and record-scope enforcement too. |
| Legacy settings | `qualityfriend/housekeeping_utills/utill_housekeeping_added.php` refers to floors, room categories, rooms, cleaning/laundry frequency, room tasks, and checklists. |
| Legacy operations | `housekeeping_rooms_detail.php` refers to reservations, guests, housekeeping state, cleaning dates, room checks, and arrival checks. `utill_update_assign_room.php` distinguishes permanent assignments and dated extra jobs. |
| Legacy caveat | Legacy assignment code also resets room status/completion. Treat this as behavior to review, not a rule to copy. New assignments should not silently invalidate completed cleaning. Source inspection does not prove legacy rows are current, complete, or suitable for migration. |

## Proposed data model

Names below are proposed domain entities, not committed Prisma models. Every operational entity belongs to a hotel tenant. Reuse existing users, departments, and audit infrastructure.

| Entity | Main fields and purpose |
| --- | --- |
| HotelTenant extension | IANA time zone and, if required, an explicit business-day cutoff. Do not infer the hotel time zone from the developer machine or UI language. |
| Floor | Stable UUID, hotel, code/number, translated names, display order, active/archive state. |
| RoomCategory | Translated names; express, normal, departure, and final-cleaning durations in integer minutes. |
| CleaningPolicy | Category reference, cleaning/laundry interval or weekday rules and effective dates; clarify exact legacy recurrence semantics before implementing. |
| Room | Stable UUID, hotel, string room number, names, floor/category foreign keys, active/archive state. Unique room number within hotel. Room numbers may be alphanumeric. |
| Reservation / StayRoomSegment | Reservation status/source and one or more dated room segments, planned arrival/departure dates and times, actual check-in/out timestamps, minimal guest display information and language. Room moves must not count as hotel departures. A smaller single-room stay model is acceptable only if imports guarantee this limitation. |
| RoomOperationalState | Current cleanliness (`DIRTY`, `CLEANING`, `CLEAN`, `INSPECTED`), DND/no-service flags with validity/clear times, express priority/deadline, version and last update actor. Occupancy comes from stays, not cleanliness. |
| HousekeepingJob | Room or extra-job reference, service date, cleaning type, optional stay reference, status, priority, due time, estimated-minute snapshot, actual start/completion, creator and version. Several distinct jobs per room/day must be representable. |
| AssignmentRule | Room/extra-job default assignee, effective date range and applicable recurrence. Models the permanent option without overwriting daily history. |
| JobAssignment | Job, user, assignment time/actor/source and replacement history. One active primary assignee per job initially; explicit unassignment overrides a permanent rule for that day. |
| ExtraJobDefinition | Translated name, estimated minutes, active/archive state. Execution and completion belong to dated jobs, not the definition. |
| ChecklistTemplate / Item | Room/category applicability, room-cleaning versus arrival-check type, ordered labels and version. |
| JobChecklistItem | Snapshot of applicable item text/version, completed/skipped state, actor/time. Old check results must survive template edits. |
| RoomNote / OperationalEvent | Room/job/stay references as appropriate, note or typed event, actor/time. Keep operational history beyond the generic audit diff. |
| Handover / HandoverItem | Shared module records with shift/date, author, status, structured open issues, priority, due time, responsible user/department, room/job links and resolution. Design shared references now; implement the wider handover workflow separately. |
| StaffAvailability | Shared work intervals, breaks, leave/unavailability and capacity. Needed before intelligent allocation; department membership or a hard-coded 480 minutes does not prove availability. |

Avoid an all-purpose JSON data store. Use foreign keys, typed statuses, dates, and numeric durations for facts the system must filter or aggregate. JSON is appropriate for audit deltas or source metadata. Translated display text must not act as identifiers.

## Integrity and operational rules

- Derive tenant and actor from the authenticated server session. Enforce view/create/update/change-status/assign/delete permissions and OWN/department/all scope on every endpoint and later tool. Never trust a model-supplied tenant ID. Use composite tenant/entity references where practical to prevent cross-hotel relations.
- Store instants as UTC timestamps and service dates as explicit hotel-local dates. Keep planned dates separate from actual event timestamps. Resolve `today` once per request using the hotel's time zone.
- Define departure metrics explicitly: scheduled departing stays, actual checkouts, and distinct rooms are different counts. Exclude cancelled/no-show stays where appropriate; distinguish remaining departures from all planned departures. Count final stay departures rather than room moves. A room may have both departure and arrival on the same day.
- Keep cleanliness, occupancy, service restriction, priority, and assignment separate. DND/no-service block ordinary work according to a documented rule; any override needs an authorized actor and reason. Do not mark a room dirty merely because its assignee changes.
- Snapshot estimates when creating a job so category edits do not rewrite historical workload. Generate daily jobs idempotently with a stable occurrence key; permanent defaults apply unless an explicit daily override exists.
- Apply assignment/status/checklist changes and their audit records in transactions. Use versions to reject stale conflicting edits. Record who changed status, when cleaning started/completed, and who inspected it; define allowed status transitions and reopen behavior before implementation.
- Archive master data referenced by history. Do not cascade-delete completed jobs or stays when a room/category/user becomes inactive.
- Index tenant + service date/status/assignee, tenant + planned departure, tenant + planned arrival, room + event time, and provider + external identifier within a tenant. Bound and paginate list queries.
- Track source system, external identifiers, synchronization time and failures. Preserve manual changes according to explicit field ownership rules. Distinguish unknown/unavailable/stale data from a verified zero.

## Backend service contracts

Implement plain server-side domain services first, then thin HTTP routes. Proposed route families under `/api/housekeeping`:

- `/floors`, `/categories`, `/rooms`, `/extra-jobs`: validated CRUD and archival.
- `/overview?date=...`, `/rooms/:id`: board counts, room facts and detail projections.
- `/jobs?date=...`, `/jobs/:id/status`, `/jobs/:id/checklist`: dated execution state.
- `/schedule?date=...`, `/assignments`, `/assignment-rules`: workload, daily changes and permanent defaults.
- `/rooms/:id/notes`, `/rooms/:id/history`: traceable context.

Reservation import/manual maintenance needs its own ingestion boundary; no missing UI form should be invented during backend work. Return stable IDs alongside the existing display values so a later adapter can preserve the UI. The current `[roomNumber]` route can resolve a tenant-scoped room number; database relationships should use UUIDs. Return validation errors, forbidden/not-found responses, and version conflicts consistently.

Future internal functions can wrap `getDepartures`, `getHousekeepingOverview`, `getRoomHistory`, `getStaffWorkload`, and `getOpenHandovers`. They should return bounded structured data with explicit units, date, time zone, count definitions, source IDs, as-of timestamp, and completeness. Example conceptual departure result:

```json
{
  "date": "2026-09-12",
  "timeZone": "Europe/Rome",
  "metric": "scheduled_departing_stays",
  "stayCount": 2,
  "distinctRoomCount": 2,
  "rooms": [{"number": "43"}, {"number": "51"}],
  "completeness": "complete"
}
```

This is illustrative data, not a claim about the current hotel. Production responses also need source IDs and freshness information. Do not expose unrestricted SQL or return credentials/unnecessary guest details to the model. Treat free-text notes as data, not tool instructions.

## Future examples and dependencies

| Request | Authoritative inputs |
| --- | --- |
| How many departures today, and which rooms? | Valid stay/room segments, planned dates, actual checkout events, hotel time zone and stated count definition. |
| Rooms 45 and 51 need cleaning before 14:00 | Open jobs, room references, real deadlines/arrival times and service restrictions. An express flag alone cannot establish a 14:00 deadline. |
| AI Allocate | Jobs/estimates, staff availability, capacity/breaks, existing commitments, restrictions and assignment rules. Later AI produces a proposal; ordinary backend validation must enforce constraints before applying it. Current mock behavior remains unchanged. |
| Handover AI Summary | Authorized handover items, open jobs/issues and resolution history. Generated prose must preserve source references and unresolved facts. |
| Zorah is off; breakfast cover unresolved | Staff absence and shift/coverage records from the scheduling domain. Housekeeping tables alone cannot support this claim. |
| New five-star review awaiting reply | Actual own-hotel review, publication time, rating and response state from a review integration. A TripAdvisor ID or competitor data is insufficient. |

The dashboard should eventually compose facts from these domains, respecting each domain's permissions. Missing sources should yield unavailable/partial results rather than invented facts. No AI summary storage, inference calls, allocation engine, or internal MCP server is part of this phase.

## Implementation sequence and outstanding decisions

1. Verify live schema/migration state with read-only metadata queries and audit available source data without exporting guest records. Determine the source of new-project reservations: PMS/import, legacy synchronization, or manual backend entry. No migration from the old database is assumed.
2. Confirm hotel time zone, departure count convention, recurrence rules, DND/no-service behavior, inspection permissions, and permanent-versus-daily assignment precedence. Obtain actual source formats before finalizing stay/import constraints.
3. Add migrations for master data and daily operations; implement tenant-scoped services, access checks and audit/history. Retain missing wider-module dependencies as explicit unavailable capabilities.
4. Implement non-AI APIs and verify tenant isolation, permission scopes, persistence, same-day turnover, cancellations/room moves, local-day boundaries, recurrence idempotency, assignment conflicts, and checklist history. Verify that missing reservation data does not appear as zero departures.
5. Connect existing UI only when explicitly authorized, preserving all visual elements. Until then, backend endpoints can be complete and tested while the screens continue using fixtures.
6. Later verify the existing provider's tool-calling compatibility, add read-only internal tools, then summaries and validated allocation proposals. Keep this work separate from external MCP integration changes.

No runtime tests or database mutations were required for this documentation-only review. Source inspection establishes a starting design, not live data availability or completed backend functionality.
