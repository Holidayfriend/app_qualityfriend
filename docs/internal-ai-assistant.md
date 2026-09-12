# Internal AI Assistant — product-wide architecture

Status: agreed architectural direction; AI implementation is deferred. This document is the shared reference for every new module and backend change. Housekeeping is the first use case, not the boundary of the assistant.

## Purpose

The Internal AI Assistant is a core capability of the whole QualityFriend product. It will understand authorized system data, answer questions, summarize information, recommend changes, and perform authorized actions across modules.

It is separate from the existing external MCP integration. Function calling can connect the assistant to application services directly; a dedicated internal MCP interface is optional later. Neither the database nor module services should depend on that transport choice.

## Expected capabilities

| Area | Examples |
| --- | --- |
| Housekeeping | Allocate jobs, explain room status, summarize workload, recommend cleaning priorities. |
| Jobs | Create, assign, prioritize, and manage jobs using operational context. |
| Shifts | Use demand and availability to suggest or automatically create shifts under an authorized policy. |
| PDFs/documents | Retrieve and understand permitted documents, supporting answers with source/page references. |
| Dashboard | Combine daily facts, unresolved issues, alerts, and recommendations across permitted modules. |
| Revenue | Calculate metrics, identify trends, explain changes, and suggest actions. |
| Future modules | Add domain tools to the shared assistant without creating a separate assistant architecture. |

## Shared architecture

Request flow:

1. The server authenticates the user and establishes hotel, permissions, time zone, and request context.
2. A shared assistant service sends the question and relevant tool definitions to the model.
3. The model requests a named tool with structured arguments.
4. The server validates the arguments and authorization, then runs the owning module's query or command service.
5. The service returns structured results with source references and freshness information.
6. The assistant explains the results, presents a proposal, or reports the outcome of an authorized action.

The model does not receive database credentials or unrestricted SQL access. Tool definitions describe available operations; they do not grant authorization. The backend remains authoritative for permissions, calculations, constraints, and record changes.

Shared components belong outside any individual module:

- Provider adapter and assistant orchestration.
- Tool registry and argument/result contracts.
- Authorization context and execution policy.
- Conversation storage, document retrieval, and source references.
- Execution audit, background execution context, usage limits, and error handling.

Each module owns its facts and business rules. Its ordinary HTTP APIs and future assistant tools call the same backend services. Cross-module workflows compose those services instead of duplicating business logic.

## Multi-tenancy and permissions are mandatory

- Obtain tenant and actor identity from trusted server context. Never accept model-provided tenant IDs as authority.
- Enforce tenant, module, action, and record-scope permissions on every query and command. Being able to open the assistant or dashboard does not grant access to all modules.
- Validate related record IDs within the same tenant. Prefer database constraints that also prevent cross-tenant relationships.
- Apply equivalent isolation to document files, extracted text, retrieval indexes, conversations, generated summaries, caches, exports, and background jobs.
- Preserve tenant/actor context in queued work and recheck relevant authorization before execution. Scheduled automation needs an explicit tenant-bound execution identity and policy.
- Filter unauthorized facts before they reach the model. A generated summary must not indirectly disclose restricted revenue, personnel, or guest information.
- Send only the data needed for the task. Keep credentials and unnecessary personal information out of prompts, tool results, and logs.

## Database requirements for every module

Design a reliable ordinary backend first. AI readiness means clear, queryable facts and reusable services, not a duplicate AI database.

| Requirement | Expected design |
| --- | --- |
| Identity | Stable record IDs and tenant-scoped foreign keys; display names are not identifiers. |
| Structured facts | Typed statuses, dates, numeric values, units, and relationships for searchable operational facts. Use JSON for suitable metadata, not as the sole store for core operations. |
| Time | UTC instants plus explicit hotel-local service dates where needed. Resolve “today” using the hotel's configured time zone. |
| Metrics | Define what is counted, included, excluded, and grouped. Calculate counts and financial totals in backend code/database queries. Include currency and period for revenue metrics. |
| History | Record actor, creation/update times, meaningful status changes, and actions. Preserve history when master data is archived. |
| Provenance | Record external source IDs, import/sync timestamps, and relevant data ownership. |
| Completeness | Distinguish zero, unknown, unavailable, stale, and partial results. |
| Reliability | Use transactions, idempotency, and conflict detection for writes and repeated background work. |
| Query efficiency | Index common tenant/date/status/assignee filters and bound list results. |

Do not copy operational records into unstructured summaries as their source of truth. Document retrieval can supply written guidance; live queries should supply current room counts, shift availability, and revenue calculations.

## Tool contracts

Expose narrow domain operations such as `getDepartures`, `getOpenJobs`, `getStaffAvailability`, `createJob`, or `getRevenueMetrics`. These names are illustrative, not implemented endpoints.

Each tool should define:

- Purpose, input types, required permissions, and whether it reads or changes data.
- Validated dates, filters, record IDs, bounded pagination, and supported scopes.
- Structured output with explicit metric definitions/units, source record references, as-of time, and completeness where relevant.
- Predictable validation, forbidden, missing-record, stale-data, and conflict errors.
- For writes: idempotency strategy, transaction boundary, audit behavior, and applicable execution policy.

The backend must enforce these rules even if the model supplies invalid arguments or calls a tool unexpectedly. Avoid generic tools such as unrestricted `runSql` or arbitrary record updates.

## Queries, suggestions, and actions

**Queries** read permitted facts and produce answers. Example: scheduled departing stays today, their room numbers, and the count definition.

**Suggestions** propose changes without applying them. Example: allocating cleaning jobs using real availability, estimated durations, deadlines, and existing assignments. Record assumptions and missing inputs; do not invent staff availability.

**Actions** change records through ordinary validated commands. They require user authorization or an explicit configured automation policy. Whether confirmation is needed depends on that policy and the action; already-authorized automation does not require a prompt for every step. Check current state before applying a proposal so stale recommendations cannot overwrite newer work.

Cross-module actions need an explicit failure strategy. For example, creating shifts and assigning jobs must handle partial completion, retries, and recovery rather than claiming success when only one operation finished.

## Documents and cross-module summaries

The shared document service should retain tenant ownership, access scope, source/version, and page references for extracted content. Apply permissions during retrieval and handle archive/deletion or permission changes in any derived index.

Treat document text, notes, reviews, and imported content as evidence, not instructions that can override application rules or request unauthorized tool execution.

Dashboard summaries compose authorized facts from their owning modules. A statement about departures needs stay records; a statement about missing breakfast cover needs shifts/absence records; a review awaiting reply needs actual review and response state. Missing sources produce partial/unavailable results, not fabricated alerts.

Generated output should carry enough source/freshness information to be checked and refreshed. Stored summaries and conversations must not become a way around later permission changes.

## OpenAI connection

A secret-safe local check confirmed a populated `OPENAI_API_KEY` in `.env`. Its validity, billing access, and model availability have not been tested. Keep provider access server-side and never expose the key to browser code, prompts, or logs.

A direct OpenAI adapter can serve the Internal AI Assistant independently of the external MCP integration. Reusing the external provider service instead would require verifying its inference and tool-calling support; it is not a prerequisite for this architecture.

OpenAI supports application-defined function tools: the application executes requested calls and returns their results. See [official function-calling documentation](https://developers.openai.com/api/docs/guides/function-calling). Verify current API documentation before implementing the provider adapter. No specific model or API migration is selected here.

## Checklist for every new module

Before finalizing its database/backend design:

- Read this document and list the module's future questions, suggestions, and actions.
- Identify authoritative facts, data sources, missing inputs, and shared entities owned by other modules.
- Define tenant boundaries, permissions, record scope, time semantics, and metric definitions.
- Create structured models, history, and reusable query/command services independently of AI.
- Document the future tool contracts and source references those services can provide.
- Define write validation, audit, retry/conflict behavior, and any intended automation policy.
- Verify tenant isolation, restricted-user access, calculations, unavailable-data behavior, and important write invariants when implementing the backend.
- Record unresolved gaps in the module's design document. Do not change existing UI or invent missing controls without authorization.

This checklist guides backend design; it does not require implementing AI tools or speculative tables for every future feature immediately.

## Delivery boundaries

Current work starts with the ordinary Housekeeping backend. AI implementation remains deferred, and the existing UI must remain unchanged unless explicitly authorized.

Later delivery can add the shared assistant foundation, read-only tools, document retrieval and summaries, then suggestions and authorized actions as each module's data becomes reliable. Keep the existing external MCP integration separate throughout.

Module reference: [Housekeeping backend design](housekeeping-backend-design.md).
