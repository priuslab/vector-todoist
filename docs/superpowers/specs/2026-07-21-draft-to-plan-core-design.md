# Draft-to-plan core: design specification

## Problem

The product currently saves Brain Dump drafts and can run AI analysis, but the user cannot reliably turn a saved draft into persistent tasks, ideas and an Oracle graph path. The onboarding goal UI also advances without reliably creating the user's primary goal. Demo fallbacks hide these failures.

This leaves the central promise incomplete: **thoughts -> realistic next steps -> plan for today -> visible connection to a goal**.

## Product decision

Use a **one-draft-at-a-time, review-before-apply** flow. AI may propose changes, but the user must explicitly confirm before any task, idea or graph relationship is persisted.

Alternatives rejected:

- Automatic batch processing of all drafts: fast but can create noisy and incorrect plans.
- Manual task creation only: dependable but removes the core AI value.

## Scope

### 1. Primary goal is real

- Manual onboarding goal creation calls the existing authenticated `POST /api/v1/goals` endpoint.
- AI goal-discovery confirmation also persists the selected goal through that endpoint.
- Screens read the persisted goal; a demo goal is used only in explicit QA/demo mode, never as a silent production fallback.
- A user without a goal is guided to create one before applying a draft's proposals.

### 2. Draft-to-proposal flow

Each saved Inbox draft gets a clear action: **"Розібрати з AI"**.

1. The client requests the draft's existing analysis. Analysis is idempotent: if it has already completed, reuse it rather than paying for/repeating an AI call.
2. If confidence is low, ask at most one critical clarification. This is enforced server-side; a user must never be looped through multiple questions.
3. Present a review screen containing:
   - up to three proposed tasks with title, duration, priority and optional deadline;
   - proposed ideas, visibly separate from tasks and defaulting to backlog;
   - the selected primary goal link;
   - editable/removable proposal rows;
   - an explicit **"Зберегти пропозиції"** confirmation action.
4. The client creates a plan preview, then applies the returned Change Set. No AI provider writes directly to PocketBase.
5. On successful apply, show exact saved counts and links to Today, Inbox and Oracle.

### 3. Persisted relationships

On the confirmed apply, all created tasks and ideas receive:

- `sourceDump` pointing to the source Brain Dump;
- `goalId` pointing to the selected primary goal;
- a confirmed Oracle edge to that goal.

The draft is marked as applied/classified. Repeating an apply request with the same idempotency key must not create duplicates.

### 4. Existing drafts

The user can process the existing backlog of drafts individually. We do not auto-process all saved drafts in this release. After confirmation, the review screen can offer **"Наступна чернетка"**.

## Technical boundaries

- Extend the existing goal API, Brain Dump analysis API, plan preview/apply Change Set and Oracle repositories; do not create parallel persistence paths.
- Add any missing PocketBase migrations for `goalId` / source fields and graph-edge creation.
- Preserve ownership checks for every goal, draft, task, idea and edge.
- Remove production demo fallbacks that can make a failed API call look successful.
- Error states must expose a retryable explanation and retain the draft; no data is lost.

## Mobile UX requirements

- Ukrainian text only.
- Primary controls are 52-56 px high; all interactive targets at least 44 px.
- The review flow is vertically scrollable above a fixed action footer.
- Selected choices have an obvious visual state.
- The success screen must not require a refresh before showing newly persisted entities.

## Acceptance checks

1. A new manual goal survives refresh and appears on the goal and Oracle screens.
2. A saved text or voice draft is visible in Inbox after refresh.
3. Selecting "Розібрати з AI" reuses completed analysis or asks no more than one clarification.
4. Confirming a proposal creates only the confirmed tasks and ideas once.
5. Created entities appear immediately in Today/Inbox and on a refreshed session.
6. Oracle shows the primary goal plus the linked created task/idea and their edges.
7. Applying the same Change Set twice cannot duplicate records.
8. A failed analysis/apply keeps the source draft visible and offers a useful retry path.

## Delivery order

1. Goal persistence and removal of misleading production fallback.
2. Server-side preview/apply support for goal-linked proposals and Oracle edges, including migrations and tests.
3. Inbox/review/success UI wiring.
4. End-to-end local verification using a real PocketBase instance, then production deployment verification.
