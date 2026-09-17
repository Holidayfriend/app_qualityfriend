# Internal AI Assistant — how everything works

Status: agreed direction. AI features in the UI are mostly dummy today. This file is the memory of **how our hotel data talks to the model**. Implementation is deferred until a module’s ordinary backend is solid.

**Housekeeping backend** is the first data use case, not the limit of the assistant. See also [Housekeeping backend design](housekeeping-backend-design.md).

**Out of scope for this document:** the external MCP product. This file is only **QualityFriend data + our APIs + the language model**.

---

## 1. One rule (never change this)

The model **does not** get access to MySQL. There is no “link ChatGPT to the database.”

QualityFriend **chooses** a small pack of facts for **this job**, **sends** that pack with the question (server-side API key), and **shows** the reply.

```
Our data (DB, ASA, CV files, manuals)
        ↓
Backend builds a pack for THIS job only
        ↓
Language model (OpenAI / Claude / …) — key stays on the server
        ↓
Answer / score / draft / suggestion on the screen
```

- Do not dump every table into one prompt.
- If it is not in the pack, the model should say it does not know — not invent it.
- Writes (assign a job, save a score) go through **our** APIs after permission checks, not through the model “editing the DB.”

From the **user’s** view it is always: question in → help out. Staff never see “tools” or “RAG.”

---

## 2. Chosen approach

Staff see one assistant. We build **two layers of the same idea**, not two products.

| Layer | When | What we send |
| --- | --- | --- |
| **A — Pack-and-send (default, build first)** | We already know the pack | This CV, this review, today’s briefing numbers, the matching manual **sections** + the question (+ last chat turns) |
| **B — Internal tools (later)** | One bag is too big, or we must **save** an assignment | Model may request named operations (`getRooms`, `assignExtraJob`). **We** run them on **our** data. Still no full DB access. |

Build **A** first: manuals Q&A, recruiting score, dashboard briefing, handover summary, review draft.

Add **B** later: housekeeping allocate that actually creates/assigns extras, multi-step “what’s going on today.”

Do not start with a full tool platform. Pack-and-send and tools are not different AIs.

---

## 3. RAG (what the client said)

**RAG** = **Retrieval-Augmented Generation** = search first, then answer.

Without RAG: you only ask the model. It uses **generic** knowledge. It does not know Weihrerhof handbooks.

**RAG style (client confirmed):**

1. **Retrieval** — find the **relevant sections** of **our** documents (not all files).
2. **Augmented** — add those sections to the question.
3. **Generation** — the model writes the answer from that pack.

Example: “What is the fire procedure?” → pull Brandschutz chunks → send question + chunks → answer from **our** docs.

Department filter: search Housekeeping manuals for a housekeeper; do not search the whole unsorted pile.

---

## 4. Manuals = the knowledge base for questions

### What the client confirmed

- Pick **department** (Reception, Housekeeping, Kitchen, Technik, …) **or hotel-wide**, **then** add the document. Intentional: otherwise one pile, wrong team, nobody owns updates.
- Those Manuals/Documents **are** the knowledge base for AI replies (RAG, scoped by department).
- Upload **once**. Same files for staff reading **and** for AI. No second “AI-only” library.

### Two views, one store (our store)

| View | Who | What |
| --- | --- | --- |
| Settings knowledge | Admin / Management | Create department (or hotel-wide) bucket, upload, delete |
| `/manuals` | Roles that can see Manuals | Search, filter by department, read |

Intro on Manuals is correct: documents come from the knowledge base; the AI assistant uses the same ones.

### Chat: do not send all 10 PDFs every time

Index **once** on upload: extract text, split into chunks, store with hotel + department + document + page. **Our** index.

**Each message:**

1. Staff asks.
2. Search the index → a **few** matching chunks.
3. Send: **this question + last few turns of this chat + those chunks**.
4. Answer from that pack.

**Follow-up** (“and wheelchair guests?”): we keep **conversation history** on our server (`ai_conversations` + `ai_conversation_messages`). One saved thread per user per assistant (the 7 items in `/ai-assistant`). Retrieve new chunks if needed. Send history + new bits. **Not** all 10 files again.

To add a live assistant later: implement a reply in `lib/ai/conversations.ts` (`produceReply`). Manuals is the only live pack today.

**New chat:** empty history; search only for the new question.

The model does not stay “logged into” the library. **We** remember the thread. The library stays in **our** store.

If it is not in the manuals (or not retrieved), say so — do not invent hotel procedure.

---

## 5. Same idea for a person (CV + extra files)

Question: “How many years of experience does she have?”

Pack: **that** application’s CV + extra files (certificates, letter, quiz) + the question.

Answer from **those files**, same as a manuals question from handbook pages.

Recruiting UI today: dummy **AI score**, **AI recommendation**, **AI competency assessment**. Real version: pass job + CV (+ extras), save structured `{ score, recommendation, competencies }`.

---

## 6. `/ai-assistant` (dummy now — all of this is possible)

One chat. Left list = **different packs**, not different products.

| Assistant | Pack we send | Example |
| --- | --- | --- |
| General | Today’s ops + permitted manual chunks | Daily issues / fire procedure (RAG) |
| Write a handover | Today’s tasks, rooms, notes | Draft shift handover |
| Reply to a review | That review text | Wagner TripAdvisor draft (demo already) |
| Budget | Budget/forecast numbers | Explain actual vs plan |
| Recruiting | Job + CV / extras | Experience, fit, interview help |
| Optimize schedule | Shifts, absences | Cover for Zorah |

Screen today: demo echo. Live: load the slice, call the model, show the reply.

---

## 7. Other screens (same pattern; mostly dummy)

| Where | Pack we send | What we get |
| --- | --- | --- |
| Dashboard AI daily analysis | Arrivals/departures, room status, open tasks, roster, reviews | Short briefing (express rooms, missing breakfast cover, unanswered review) |
| Handovers ✨ AI summary | That handover + related facts | Summary for next shift |
| Housekeeping schedule AI allocate | Cleaners, rooms, extras, occupancy, weather, upcoming guests | **Suggest** extras and assignees; **create/assign only** via our HK APIs after confirmation |
| `/revenue` | Occupancy, rates, competitors when specified | Commentary — **paused** in the handoff; mock is not a spec |

Handoff: Handbooks are in current scope. Budget / Dienstplan / Analytics / AI Revenue Forecast were deferred or incomplete.

---

## 8. Queries, suggestions, actions

**Query** — read permitted facts, answer. Example: fire procedure from manuals; CV years of experience.

**Suggestion** — propose, do not write yet. Example: HK allocate plan.

**Action** — change records through **our** validated commands (permissions, confirmation/policy, check current state so a stale suggestion cannot overwrite newer work). Partial failure (create shift but fail assign) must be explicit, not “success.”

---

## 9. What each pack is allowed to contain

- Tenant/hotel from **server session**, never from the model.
- Module + record permissions: opening the assistant does not grant Budget or other people’s CVs.
- Filter facts **before** they reach the model. A briefing must not leak revenue or private notes the user cannot see.
- Send only what the job needs. No credentials, no extra personal data in prompts or logs.
- Documents, extracted text, chat history, scores, caches: same tenant isolation as the source records.
- Summaries are **not** the source of truth. Live rooms/shifts/money come from live queries. Docs supply written procedure.

---

## 10. Data we need (ordinary backend first)

AI does not need a second “AI database.” It needs queryable facts in the real modules.

| Need | Meaning |
| --- | --- |
| Identity | Stable IDs, tenant-scoped FKs; names are not IDs |
| Structured facts | Statuses, dates, numbers, units, relationships |
| Time | UTC + hotel-local “today” |
| Metrics | Defined counts/totals in **our** code, not invented by the model |
| History | Who changed what, when |
| Completeness | Zero vs unknown vs stale vs partial |
| Documents | Tenant, department/hotel-wide, version, page refs on chunks |

---

## 11. Internal tools (later only)

Illustrative names, not built: `getDepartures`, `getOpenJobs`, `getStaffAvailability`, `searchManualChunks`, `createJob`, `getRevenueMetrics`.

Each tool: purpose, types, permissions, read vs write, bounded lists, structured result with sources and as-of time, no `runSql`. Backend rejects invalid or unauthorized calls even if the model asks.

---

## 12. Provider (OpenAI or similar)

Use `OPENAI_API_KEY` from the server `.env` (optional `OPENAI_MODEL`). Never send the key to the browser. Pack-and-send posts the question + retrieved chunks to OpenAI chat completions. This is independent of `MCP_API_BASE_URL`.

---

## 13. Checklist before a module is “AI-ready”

- List the questions, suggestions, and actions for this module.
- Name the authoritative facts and who owns them.
- Tenant, permissions, “today,” metric definitions.
- Normal query/command APIs **without** AI first.
- For documents: upload → chunk index → retrieve-by-question.
- For chat: store thread history; never resend the whole library.
- Writes: validation, audit, conflicts, confirmation policy.
- Missing data → partial/unavailable, not fake alerts.

Do not invent UI or speculative AI tables without authorization. Existing screens stay dummy until that module is authorized.

---

## 14. Delivery order

1. Ordinary module backends (Housekeeping first).
2. **Pack-and-send:** document index + RAG chat; recruiting score; dashboard briefing; handover summary; review draft.
3. Suggestions that still need a human confirm (HK allocate).
4. Authorized actions through our APIs.
5. Internal tools only where pack-and-send is not enough.

---

## 15. Client quote (Manuals)

> Documents are assigned to a department first, and then added under that department. This is intentional: without a department structure, all manuals would end up in one large, unsorted pile. Assigning documents to departments keeps each team’s manuals scoped to what they need, and makes it clear who keeps which documents up to date.

> These Manuals/Documents will later serve as the knowledge base for AI replies. The plan is a RAG-style setup: when a staff member asks a question, the relevant document sections get pulled and passed to the model as context, so the AI answers using our actual internal documentation. The department structure also lets us scope AI answers to the right department’s documents rather than searching across everything.
