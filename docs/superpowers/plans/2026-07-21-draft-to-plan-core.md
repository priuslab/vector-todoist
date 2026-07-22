# Draft-to-plan core implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one confirmed Brain Dump create persistent task and idea entities linked to the user’s primary goal, then show them in Inbox, Today and Oracle.

**Architecture:** AI remains read-only. Existing Brain Dump analysis produces structured proposals; the user confirms a server-side Change Set. Extend that Change Set with an owned `goalId`, create the task/idea and confirmed graph edges during apply, and preserve the source draft on failure.

**Tech Stack:** React 18/Vite, Vitest/Testing Library, TypeScript/Fastify, PocketBase.

## Global Constraints

- Ukrainian user-facing copy only.
- AI proposes; user explicitly confirms before persistence.
- At most one critical clarification per Brain Dump.
- A production screen must never silently substitute `DEMO_GOAL`.
- Ideas remain backlog items, not tasks.
- Preserve ownership, idempotency and saved drafts on errors.
- Touch targets at least 44 px; primary actions 52–56 px.

---

## File map

- `prototype/src/features/onboarding/GoalSetup.jsx` — real manual/AI goal creation.
- `prototype/src/features/onboarding/goal-discovery.test.jsx` — goal persistence regression coverage.
- `pocketbase/pb_migrations/1784333300_task_goal_link.js` — missing `tasks.goalId` relation/index.
- `gateway/src/repositories/taskRepository.ts`, `ideaRepository.ts` — typed goal/source fields.
- `gateway/src/modules/planning/planSchemas.ts`, `planService.ts` — goal-aware preview/apply and graph edges.
- `gateway/test/planFlow.test.ts`, `gateway/test/pocketbaseSchema.test.ts` — persistence, ownership and schema tests.
- `prototype/src/features/capture/DraftPlanReview.jsx` — confirmed per-draft review UI.
- `prototype/src/features/capture/draft-plan-review.test.jsx` — review flow tests.
- `prototype/src/features/inbox/InboxScreens.jsx` — actionable draft cards.
- `prototype/src/features/capture/captureApi.js`, `prototype/src/features/today/todayApi.js` — read/preview helpers.
- `prototype/src/App.jsx`, `prototype/src/screens/ScreenRouter.jsx`, `prototype/src/screens/screenRegistry.js` — persistent `draft` query route.

### Task 1: Persist the onboarding primary goal

**Files:**
- Modify: `prototype/src/features/onboarding/GoalSetup.jsx`
- Modify: `prototype/src/features/onboarding/goal-discovery.test.jsx`
- Modify: `prototype/src/features/onboarding/onboarding-layout.test.jsx`

**Interfaces:**
- Consumes: `POST /api/v1/goals` with `{ title, description?, deadline? }`.
- Produces: `saveGoal(input): Promise<void>`; calls `onNext()` only after successful persistence.

- [ ] **Step 1: Write failing tests**

```jsx
it('posts a manual goal before advancing', async () => {
  const request = vi.fn().mockResolvedValue({ id: 'goal-1', title: 'Запустити застосунок' });
  const onNext = vi.fn();
  render(<GoalSetup screenId="goal-manual" apiClient={{ request }} onNext={onNext} onRoute={vi.fn()} />);
  await userEvent.clear(screen.getByLabelText('Головна мета'));
  await userEvent.type(screen.getByLabelText('Головна мета'), 'Запустити застосунок');
  await userEvent.click(screen.getByRole('button', { name: 'Зберегти мету' }));
  expect(request).toHaveBeenCalledWith('/api/v1/goals', expect.objectContaining({ method: 'POST' }));
  expect(onNext).toHaveBeenCalledOnce();
});
```

Add an equivalent test for `goal-test-result`, asserting the suggested title is posted before navigation.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- --run prototype/src/features/onboarding/goal-discovery.test.jsx prototype/src/features/onboarding/onboarding-layout.test.jsx`

Expected: FAIL because current footers invoke `onNext` directly.

- [ ] **Step 3: Implement controlled fields and one real save function**

```jsx
const [manualTitle, setManualTitle] = useState('');
const [manualDescription, setManualDescription] = useState('');

const saveGoal = async ({ title, description, deadline }) => {
  const cleanTitle = title.trim();
  if (!cleanTitle) return setError('Сформулюй мету, щоб продовжити.');
  setLoading(true); setError('');
  try {
    await apiClient.request('/api/v1/goals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: cleanTitle,
        ...(description?.trim() ? { description: description.trim() } : {}),
        ...(deadline ? { deadline: `${deadline}T00:00:00+00:00` } : {}),
      }),
    });
    onNext();
  } catch { setError('Не вдалося зберегти мету. Спробуй ще раз.'); }
  finally { setLoading(false); }
};
```

Replace uncontrolled `defaultValue={DEMO_GOAL...}` fields with controlled values. Manual footer calls `saveGoal({ title: manualTitle, description: manualDescription, deadline })`; AI confirmation calls `saveGoal(suggestion)`. Only use `DEMO_GOAL` when `demoMode === true`.

- [ ] **Step 4: Run verification**

Run: `npm test -- --run prototype/src/features/onboarding/goal-discovery.test.jsx prototype/src/features/onboarding/onboarding-layout.test.jsx`

Expected: PASS.

Run: `npm test -- --run`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prototype/src/features/onboarding/GoalSetup.jsx prototype/src/features/onboarding/goal-discovery.test.jsx prototype/src/features/onboarding/onboarding-layout.test.jsx
git commit -m "fix: persist onboarding primary goal"
```

### Task 2: Make plan previews and applies goal-aware

**Files:**
- Create: `pocketbase/pb_migrations/1784333300_task_goal_link.js`
- Modify: `gateway/src/repositories/taskRepository.ts`
- Modify: `gateway/src/repositories/ideaRepository.ts`
- Modify: `gateway/src/modules/planning/planSchemas.ts`
- Modify: `gateway/src/modules/planning/planService.ts`
- Modify: `gateway/test/planFlow.test.ts`
- Modify: `gateway/test/pocketbaseSchema.test.ts`

**Interfaces:**
- Consumes: plan preview request `{ goalId?: string, idempotencyKey?: string, ...existingPlanFields }`.
- Produces: task/idea proposals with `goalId`; apply writes goal-linked records plus confirmed `graph_edges`.

- [ ] **Step 1: Write failing server coverage**

Add goal and edge fakes to `repos()`, then add:

```ts
it('links confirmed proposals to an owned goal and creates Oracle edges', async () => {
  const r = repos({ goals: [{ id: 'goal-1', user: 'alice', title: 'Запустити застосунок', status: 'active' }] });
  const service = createPlanService(r);
  const preview = await service.preview(user, 'dump-1', { goalId: 'goal-1', idempotencyKey: 'plan-goal-123' });
  await service.apply(user, preview.changeSetId, {});
  expect(r.tasks[0]).toMatchObject({ goalId: 'goal-1', sourceDump: 'dump-1' });
  expect(r.ideas[0]).toMatchObject({ goalId: 'goal-1', sourceDump: 'dump-1' });
  expect(r.edges).toEqual(expect.arrayContaining([
    expect.objectContaining({ fromType: 'task', toType: 'goal', fromId: r.tasks[0].id, toId: 'goal-1', status: 'confirmed' }),
    expect.objectContaining({ fromType: 'idea', toType: 'goal', fromId: r.ideas[0].id, toId: 'goal-1', status: 'confirmed' }),
  ]));
});

it('rejects another user’s goal', async () => {
  await expect(service.preview(user, 'dump-1', { goalId: 'goal-bob', idempotencyKey: 'plan-goal-456' }))
    .rejects.toMatchObject({ code: 'INVALID_PLAN' });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm --prefix gateway test -- --run test/planFlow.test.ts`

Expected: FAIL because `goalId` is rejected and the service has no graph repository.

- [ ] **Step 3: Add the missing schema migration and types**

```js
migrate((app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  const goals = app.findCollectionByNameOrId('goals');
  if (!tasks || !goals || tasks.fields.find((field) => field.name === 'goalId')) return;
  tasks.fields.add(new RelationField({ name: 'goalId', required: false, collectionId: goals.id, maxSelect: 1, cascadeDelete: false }));
  tasks.indexes = [...(tasks.indexes ?? []), 'CREATE INDEX idx_tasks_user_goal ON tasks (user, goalId)'];
  app.save(tasks);
}, (app) => {
  const tasks = app.findCollectionByNameOrId('tasks');
  const field = tasks?.fields.find((item) => item.name === 'goalId');
  if (tasks && field) { tasks.fields.removeById(field.id); app.save(tasks); }
});
```

Extend task and idea repository record types with `goalId?: string | null` and `sourceDump?: string`.

- [ ] **Step 4: Carry the goal through preview and apply**

```ts
export const planPreviewBodySchema = z.object({
  // existing plan fields
  goalId: z.string().trim().min(1).max(128).optional(),
}).strict();

const goal = body.goalId ? await goalGraphRepository.goals.get(user, body.goalId) : null;
if (body.goalId && (!goal || goal.status !== 'active')) throw new PlanValidationError();
const proposedTasks = analysis.tasks.map((task, index) => ({ /* existing fields */, goalId: goal?.id ?? null }));
const ideas = analysis.ideas.map((idea, index) => ({ /* existing fields */, goalId: goal?.id ?? null }));
```

Inject `goalGraphRepository` into `createPlanService`. In `apply`, for each created task/idea with `goalId`, create one deduplicated edge:

```ts
await goalGraphRepository.edges.create(user, {
  fromType: entityType, fromId: entity.id, toType: 'goal', toId: String(entity.goalId),
  actor: 'ai', status: 'confirmed', confirmedBy: user.userId, confidence: 1,
  rationale: 'Підтверджено користувачем під час розбору Brain Dump.',
});
```

Store edge ids in `afterJson`, delete them before task/idea rollback on error, and update the owned draft to `status: 'applied'` only after the Change Set succeeds.

- [ ] **Step 5: Expose the persisted fields**

Add nullable `goalId` to `proposalTaskSchema`, `proposalIdeaSchema`, task response and idea response. Whitelist it in `publicTask` and `publicIdea`. Extend the PocketBase schema test to require the `tasks.goalId -> goals` relation.

- [ ] **Step 6: Verify backend**

Run: `npm --prefix gateway test -- --run test/planFlow.test.ts test/pocketbaseSchema.test.ts test/oracle.test.ts`

Expected: PASS, including repeated apply creating one task, one idea and two edges only.

Run: `npm --prefix gateway run build && npm --prefix gateway test -- --run`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add pocketbase/pb_migrations/1784333300_task_goal_link.js gateway/src/repositories/taskRepository.ts gateway/src/repositories/ideaRepository.ts gateway/src/modules/planning/planSchemas.ts gateway/src/modules/planning/planService.ts gateway/test/planFlow.test.ts gateway/test/pocketbaseSchema.test.ts
git commit -m "feat: link confirmed Brain Dump plans to goals"
```

### Task 3: Let a user review one saved draft before applying it

**Files:**
- Create: `prototype/src/features/capture/DraftPlanReview.jsx`
- Create: `prototype/src/features/capture/draft-plan-review.test.jsx`
- Modify: `prototype/src/features/capture/captureApi.js`
- Modify: `prototype/src/features/today/todayApi.js`
- Modify: `prototype/src/features/inbox/InboxScreens.jsx`
- Modify: `prototype/src/App.jsx`
- Modify: `prototype/src/screens/ScreenRouter.jsx`
- Modify: `prototype/src/screens/screenRegistry.js`

**Interfaces:**
- Consumes: `?screen=draft-plan-review&draft=<brainDumpId>`, `GET /api/v1/goals`, existing analysis and plan APIs.
- Produces: user-confirmed apply; successful actions route to Today, Inbox, or Oracle.

- [ ] **Step 1: Write failing UI tests**

```jsx
it('reviews a saved draft, confirms its proposal and navigates to Today', async () => {
  const request = vi.fn()
    .mockResolvedValueOnce([{ id: 'goal-1', title: 'Запустити застосунок', status: 'active' }])
    .mockResolvedValueOnce({ analysis: classifiedAnalysis })
    .mockResolvedValueOnce({ changeSetId: 'change-1', tasks: [proposalTask], ideas: [proposalIdea], blocks: [], unscheduledTaskIds: [], warnings: [], reasons: {} })
    .mockResolvedValueOnce({ changeSet: { id: 'change-1', status: 'applied' }, tasks: [{ id: 'task-1' }], ideas: [{ id: 'idea-1' }] });
  render(<DraftPlanReview draftId="dump-1" apiClient={{ request }} onNavigate={onNavigate} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Зберегти пропозиції' }));
  expect(onNavigate).toHaveBeenCalledWith('today-normal');
});
```

Also test that a draft card exposes `Розібрати з AI`, and that no active goal shows `Створити головну мету` rather than a hidden demo goal.

- [ ] **Step 2: Verify failure**

Run: `npm test -- --run prototype/src/features/capture/draft-plan-review.test.jsx prototype/src/features/today/today.test.jsx`

Expected: FAIL because review component and draft action do not exist.

- [ ] **Step 3: Add API and persistent route helpers**

```js
export function getGoals({ apiClient }) { return apiClient.request('/api/v1/goals'); }
export function previewBrainDumpPlan({ apiClient, id, goalId, ...input }) {
  return apiClient.request(`/api/v1/brain-dumps/${encodeURIComponent(id)}/plan-preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, ...(goalId ? { goalId } : {}) }),
  });
}
```

Update navigation so `onNavigate('draft-plan-review', { draft: draft.id })` serializes `draft` in the URL and survives refresh. Parse it in `App.jsx`; pass it through `ScreenRouter` to `DraftPlanReview`.

- [ ] **Step 4: Implement review and success screens**

```jsx
export function DraftPlanReview({ draftId, apiClient, onNavigate }) {
  const [goal, setGoal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const confirm = async () => {
    try {
      const applied = await applyChangeSet({ apiClient, id: preview.changeSetId, idempotencyKey: preview.idempotencyKey });
      setResult(applied);
    } catch { setError('Не вдалося зберегти пропозиції. Чернетка лишилась у Inbox — спробуй ще раз.'); }
  };
}
```

Load active goals, call plan preview with the selected goal and render tasks/ideas in separate sections. Render at most the existing analysis clarification; do not create another questionnaire. A fixed footer contains `Зберегти пропозиції`. Success shows real saved counts and actions `До плану на сьогодні`, `В Inbox`, `В Oracle`.

Do not show editable controls until the API can persist those edits. Selection/removal controls are allowed only if preview payload is extended and tested to honor them.

- [ ] **Step 5: Add Inbox action**

```jsx
<Button onClick={() => onNavigate('draft-plan-review', { draft: draft.id })}>
  Розібрати з AI
</Button>
```

Keep live status copy: `Оброблено AI`, `Потрібне уточнення`, `Збережено як чернетку`. Never replace text with a demo preview.

- [ ] **Step 6: Verify frontend**

Run: `npm test -- --run prototype/src/features/capture/draft-plan-review.test.jsx prototype/src/features/today/today.test.jsx prototype/src/screens/ScreenRouter.test.jsx`

Expected: PASS.

Run: `npm run build && npm test -- --run`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add prototype/src/features/capture/DraftPlanReview.jsx prototype/src/features/capture/draft-plan-review.test.jsx prototype/src/features/capture/captureApi.js prototype/src/features/today/todayApi.js prototype/src/features/inbox/InboxScreens.jsx prototype/src/App.jsx prototype/src/screens/ScreenRouter.jsx prototype/src/screens/screenRegistry.js
git commit -m "feat: review saved Brain Dump proposals"
```

### Task 4: Verify the production-shaped vertical slice

**Files:**
- Modify: `gateway/test/planFlow.test.ts`
- Modify: `prototype/src/features/capture/draft-plan-review.test.jsx`
- Modify: `docs/superpowers/specs/2026-07-21-draft-to-plan-core-design.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: evidence that one real user path survives refresh and does not duplicate work.

- [ ] **Step 1: Add repeated-apply assertion**

```ts
const first = await service.apply(user, preview.changeSetId, {});
const second = await service.apply(user, preview.changeSetId, {});
expect(second.tasks.map((task) => task.id)).toEqual(first.tasks.map((task) => task.id));
expect(r.tasks).toHaveLength(1);
expect(r.ideas).toHaveLength(1);
expect(r.edges).toHaveLength(2);
```

- [ ] **Step 2: Run all automated checks**

Run: `npm --prefix gateway run build && npm --prefix gateway test -- --run && npm run build && npm test -- --run`

Expected: every command exits 0.

- [ ] **Step 3: Run one local live acceptance pass**

Run: `docker compose -f deploy/docker-compose.yml up -d --build pocketbase gateway`

Expected: both services are healthy in `docker compose -f deploy/docker-compose.yml ps`.

In browser, create goal `Запустити Vector`, save a draft, open Inbox → Чернетки → Розібрати з AI, confirm, refresh, then confirm: task in Today/Inbox, idea in Ideas, and goal/task/idea/edges in Oracle.

- [ ] **Step 4: Record only verified evidence**

Update `.superpowers/sdd/progress.md` with commands and acceptance result. Mark the design spec implemented only after Step 3 succeeds; otherwise record the exact failed request/status without claiming completion.

- [ ] **Step 5: Commit**

```bash
git add gateway/test/planFlow.test.ts prototype/src/features/capture/draft-plan-review.test.jsx docs/superpowers/specs/2026-07-21-draft-to-plan-core-design.md .superpowers/sdd/progress.md
git commit -m "test: verify draft to plan vertical slice"
```

## Self-review

- **Spec coverage:** Task 1 handles real goal creation; Task 2 handles goal-linked Change Set persistence, graph edges, rollback and idempotency; Task 3 gives existing drafts an explicit mobile confirmation flow; Task 4 proves persistence across refresh.
- **Scope check:** Calendar, Telegram, Stripe and batch processing are deliberately excluded until this core scenario passes.
- **Consistency:** `goalId` is the one relation name in PocketBase, repository records, schemas, client API and UI. Graph edges use the existing `graph_edges` fields.
- **No production demo fallback:** Task 1 and Task 3 explicitly prevent it.

