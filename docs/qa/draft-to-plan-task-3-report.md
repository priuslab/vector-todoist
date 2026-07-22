# Draft-to-plan core — Task 3 rereview report

## Final follow-up

- A legacy pending Change Set without a persisted scheduler `preview` now rejects
  a same-key preview replay with `CONFLICT`; the caller must use a fresh key.
  This prevents a newly calculated schedule from being displayed alongside the
  task and idea proposals already stored in the Change Set.
- Applying that legacy Change Set remains supported and persists its stored
  proposals.
- `DraftPlanReview` now uses Ukrainian count forms: `1 задача`, `2–4 задачі`,
  `5+ задач`; and `1 ідея`, `2–4 ідеї`, `5+ ідей`.

## Verification

- `npm test -- --run test/planFlow.test.ts` — 30 passed.
- `npm test -- --run src/features/capture/draft-plan-review.test.jsx` — 10 passed.
- `npm run build && npm test -- --run` in `gateway` — build passed; 231 tests passed.
- `npm run build && npm test -- --run` in `prototype` — build passed; 155 tests passed.
