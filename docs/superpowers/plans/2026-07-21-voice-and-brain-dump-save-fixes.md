# Voice Input & Brain Dump Save Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two live-tested regressions — voice Brain Dump transcription failing on every attempt, and manually typed Brain Dump text appearing to save while the app is actually stuck — by correcting the frontend error handling that causes both symptoms and hardening the Gemini call path that triggers them.

**Architecture:** Both bugs trace back to the same root condition: the local gateway process has no `GEMINI_API_KEY`, so every Gemini call (`transcriptionService.ts`, `geminiClient.ts`) throws `"... provider is not configured"` immediately. Two things turn that one missing secret into "the app looks broken" instead of "voice/analysis show a clear degraded-service message": (1) the gateway has no mechanism to load `gateway/.env` into `process.env` unless a developer's shell happens to already export it, so the key silently never reaches the running process even when it's present in the file; (2) `CaptureFlow.jsx`'s `saveDraft` collapses two different failure points (the initial draft POST vs. the follow-up AI analysis POST) into one handler, so when the draft POST itself fails it still claims "Чернетку збережено" and hands the user a retry button that is a no-op. This plan fixes the frontend correctness bug and the missing `.env` loading first (both independently testable, no secret required), flags the one step that requires a human to add a real key, hardens the Gemini fallback logic that has already needed five prior "model unavailable" patches in this repo's history, then verifies end-to-end.

**Tech Stack:** React 18/Vite, Vitest/Testing Library (frontend); TypeScript/Fastify, Vitest (gateway); PocketBase.

## Global Constraints

- Ukrainian user-facing copy only — do not introduce new English strings.
- Preserve ownership, idempotency and saved drafts on errors (existing product rule from `AGENTS.md`).
- Secrets must stay server-side and out of git — never write a real API key into a committed file, test, or this plan.
- Ideas remain backlog items; this plan does not change what gets created, only whether the user is told the truth about what happened.
- Do not touch the `.worktrees/phase-0-foundations` working tree's uncommitted files (`docs/superpowers/plans/2026-07-20-voice-text-composer.md`, `docs/superpowers/specs/2026-07-20-voice-text-composer-design.md`, modified `.superpowers/sdd/progress.md`) — that is a separate, already-completed feature's paperwork sitting in someone else's live session; it is out of scope here and is called out separately in this session's summary instead.

## File map

- `prototype/src/features/capture/CaptureFlow.jsx` — `saveDraft` conflates draft-creation failure with analysis failure.
- `prototype/src/features/capture/capture-live.test.jsx` — add the regression test that proves the fix.
- `gateway/src/modules/transcription/transcriptionService.ts` — Gemini fallback only retries on HTTP 503.
- `gateway/src/modules/ai/geminiClient.ts` — same fallback gap for text analysis.
- `gateway/test/transcription.test.ts`, `gateway/test/geminiClient.test.ts` — add the 404 fallback regression tests.
- `gateway/package.json` — `dev` script never loads `gateway/.env`.
- `gateway/.env` — needs a real `GEMINI_API_KEY` (manual step, Task 4).

---

### Task 1: Stop `CaptureFlow` from claiming a draft saved when the save itself failed

**Files:**
- Modify: `prototype/src/features/capture/CaptureFlow.jsx:38-53`
- Modify: `prototype/src/features/capture/capture-live.test.jsx`

**Interfaces:**
- Consumes: existing `createBrainDump({ apiClient, text, idempotencyKey })` and `analyze({ apiClient, id })` props (unchanged signatures).
- Produces: `saveDraft(text)` — same external behavior for every currently-passing case; the only change is that a `createBrainDump` failure now sets `saveError` and leaves the user on the current input screen instead of jumping to the `"processing"` stage.

- [ ] **Step 1: Write the failing test**

Add to `prototype/src/features/capture/capture-live.test.jsx` (after the existing `"keeps the text and offers a retry after a network failure"` test):

```jsx
it("shows a real save error instead of a false 'saved' message when the draft POST fails with a connected API client", async () => {
  const user = userEvent.setup();
  const createBrainDump = vi.fn().mockRejectedValue(new Error("offline"));
  const apiClient = { request: vi.fn() };
  render(<CaptureFlow apiClient={apiClient} createBrainDump={createBrainDump} />);
  await user.click(screen.getByRole("button", { name: "Увімкнути текстовий режим" }));
  const textarea = screen.getByRole("textbox", { name: "Твоя думка" });
  await user.clear(textarea);
  await user.type(textarea, "Ідея, яку я хочу зберегти");
  await user.click(screen.getByRole("button", { name: "Зберегти чернетку" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Не вдалося зберегти");
  expect(screen.queryByText("Думки вже збережені", { exact: false })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Зберегти чернетку" })).toBeEnabled();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd prototype && npm test -- --run src/features/capture/capture-live.test.jsx`

Expected: FAIL — the new test's alert has text `"Не вдалося завершити аналіз. Чернетку збережено — спробуй ще раз."` instead of the expected `"Не вдалося зберегти"`, because the current code always routes an `apiClient`-present failure through the "analysis failed" message regardless of which call actually threw.

- [ ] **Step 3: Split draft creation and analysis into separate try/catch blocks**

Replace `saveDraft` in `prototype/src/features/capture/CaptureFlow.jsx:38-53`:

```jsx
  const saveDraft = async (text = draftText) => {
    setSaveError(false); setSaving(true);
    let draft;
    try {
      draft = await createBrainDump({ apiClient, text, idempotencyKey });
    } catch {
      setSaveError(true); setSaving(false);
      return;
    }
    setDraftId(draft.id);
    if (!apiClient) { setSaving(false); setStage("saved"); return; }
    setAnalysisError(""); setStage("processing");
    try {
      const result = await analyze({ apiClient, id: draft.id });
      setAnalysis(result.analysis); setStage(result.analysis.questions?.length ? "clarification" : "result");
    } catch {
      setAnalysisError("Не вдалося завершити аналіз. Чернетку збережено — спробуй ще раз.");
    } finally {
      setSaving(false);
    }
  };
```

This keeps every existing success path and the no-`apiClient` (demo) failure path identical. The only behavior change: when `createBrainDump` itself throws, the user now sees the real `"Не вдалося зберегти"` error on the screen they were already on (with their typed text intact and the save button still enabled), instead of being moved to the "processing" screen with a false "already saved" claim and a retry button (`retryAnalysis`) that silently does nothing because `draftId` was never set.

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd prototype && npm test -- --run src/features/capture/capture-live.test.jsx`

Expected: PASS — all tests in the file, including the new one.

- [ ] **Step 5: Run the full frontend suite**

Run: `cd prototype && npm test -- --run`

Expected: PASS — no other test depended on the old conflated error message.

- [ ] **Step 6: Commit**

```bash
git add prototype/src/features/capture/CaptureFlow.jsx prototype/src/features/capture/capture-live.test.jsx
git commit -m "fix: report the real error when a Brain Dump draft fails to save"
```

---

### Task 2: Make the Gemini fallback retry on "model not found", not only HTTP 503

**Files:**
- Modify: `gateway/src/modules/transcription/transcriptionService.ts:58`
- Modify: `gateway/src/modules/ai/geminiClient.ts:41`
- Modify: `gateway/test/transcription.test.ts`
- Modify: `gateway/test/geminiClient.test.ts`

**Interfaces:**
- Consumes: existing `createGeminiTranscriptionAdapter(options)` / `createGeminiClient(options)` signatures — unchanged.
- Produces: same `TranscriptionAdapter.transcribe` / `AnalysisAiClient.complete` contracts — only the set of HTTP statuses that trigger a same-request fallback to the next configured model changes.

This repository's git history already contains five prior commits titled "fix: fall back for unavailable ... model" — the primary Gemini model id has gone stale before and will again. The existing fallback (`gateway/test/transcription.test.ts` "falls back to Flash-Lite when the primary Gemini model is temporarily unavailable") only triggers on HTTP 503. A renamed/retired model id comes back as HTTP 404 `NOT_FOUND`, which today is thrown immediately without ever trying the configured fallback model.

- [ ] **Step 1: Write the failing tests**

Add to `gateway/test/transcription.test.ts` (after the existing 503 fallback test):

```ts
  it('falls back to Flash-Lite when the primary Gemini model id is not found', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 404, status: 'NOT_FOUND', message: 'models/gemini-3.5-flash is not found for API version v1beta.' },
      }), { status: 404, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Привіт, ти мене чуєш?' }] } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const gemini = createGeminiTranscriptionAdapter({ apiKey: 'test-key', model: 'gemini-3.5-flash', fetcher });

    await expect(gemini.transcribe({ bytes: Buffer.from('audio'), mimeType: 'audio/webm', locale: 'uk-UA' })).resolves.toBe('Привіт, ти мене чуєш?');
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/models/gemini-3.5-flash:generateContent'),
      expect.stringContaining('/models/gemini-3.1-flash-lite:generateContent'),
    ]);
  });
```

Add to `gateway/test/geminiClient.test.ts` (after the existing 503 fallback test, inside the same `describe` block):

```ts
  it('falls back to the stable Flash-Lite model when the primary model id is not found', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { code: 404, status: 'NOT_FOUND', message: 'models/gemini-3.5-flash is not found for API version v1beta.' },
      }), { status: 404, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: 'Готово' }) }] } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = createGeminiClient({ apiKey: 'test-key', model: 'gemini-3.5-flash', fetcher });

    await expect(client.complete({ brainDumpText: 'Потрібно написати план.' })).resolves.toEqual({ summary: 'Готово' });
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/models/gemini-3.5-flash:generateContent'),
      expect.stringContaining('/models/gemini-2.5-flash-lite:generateContent'),
    ]);
  });
```

- [ ] **Step 2: Run both tests and verify they fail**

Run: `cd gateway && npm test -- --run test/transcription.test.ts test/geminiClient.test.ts`

Expected: FAIL — both new tests reject with `TranscriptionProviderError`/`Error` on the first (404) response instead of resolving, because today only `status === 503` continues to the next model.

- [ ] **Step 3: Widen the fallback condition in both adapters**

In `gateway/src/modules/transcription/transcriptionService.ts:58`, change:

```ts
            if (error.status === 503 && candidateModel !== models.at(-1)) {
```

to:

```ts
            if ((error.status === 503 || error.status === 404) && candidateModel !== models.at(-1)) {
```

In `gateway/src/modules/ai/geminiClient.ts:41`, change:

```ts
            if (response.status === 503 && candidateModel !== models.at(-1)) continue;
```

to:

```ts
            if ((response.status === 503 || response.status === 404) && candidateModel !== models.at(-1)) continue;
```

Leave every other status (including 429, already covered by the existing "retains a safe Gemini status and error code" test) throwing immediately — a quota or auth error on the primary model will also fail on the fallback model, so retrying it there would only add latency before the same failure.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `cd gateway && npm test -- --run test/transcription.test.ts test/geminiClient.test.ts`

Expected: PASS — all tests in both files, including the pre-existing 503 and 429 tests (unchanged behavior for those statuses).

- [ ] **Step 5: Run the full gateway suite and typecheck**

Run: `cd gateway && npm run typecheck && npm test -- --run`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add gateway/src/modules/transcription/transcriptionService.ts gateway/src/modules/ai/geminiClient.ts gateway/test/transcription.test.ts gateway/test/geminiClient.test.ts
git commit -m "fix: fall back to Flash-Lite when a Gemini model id is not found"
```

---

### Task 3: Make the gateway load `gateway/.env` automatically instead of relying on a shell that happens to export it

**Files:**
- Modify: `gateway/package.json:7` (the `"dev"` script only — `"start"`/`"worker"` stay untouched because those run inside Docker Compose, which already injects real environment variables via `deploy/docker-compose.yml`'s `environment:` block, and `node --env-file=.env` throws if the named file does not exist in that container).

**Interfaces:**
- Consumes: nothing new — Node 20.6+'s built-in `--env-file` flag (this repo already requires `"node": ">=20"` in `gateway/package.json`).
- Produces: `npm run dev` now populates `process.env` from `gateway/.env` before `src/server.ts` runs, for any variable not already set by the calling shell (Node's `--env-file` never overrides a variable the shell already exported).

This is the actual reason the currently-running local gateway process has no `GEMINI_API_KEY`: nothing in this repository (`gateway/package.json`, `gateway/src/config.ts`, `gateway/src/server.ts`) ever reads `gateway/.env` — no `dotenv` dependency, no `--env-file` flag, no `direnv`. Every value the running process currently has (`GEMINI_MODEL`, `POCKETBASE_URL`, `PORT`, etc.) only exists because some earlier shell session manually exported them before running `npm run dev`; whatever added `GEMINI_API_KEY` to `gateway/.env` never got it into that shell.

- [ ] **Step 1: Reproduce the gap with a non-secret variable**

Run (from the repo root):

```bash
cd gateway
env -u GEMINI_MODEL npx tsx -e "console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL ?? '<unset>')"
```

Expected: `GEMINI_MODEL: <unset>` — even though `gateway/.env` defines `GEMINI_MODEL`, plain `tsx` never reads that file.

- [ ] **Step 2: Confirm `--env-file` closes the gap**

Run:

```bash
cd gateway
env -u GEMINI_MODEL npx tsx --env-file=.env -e "console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL ?? '<unset>')"
```

Expected: `GEMINI_MODEL: gemini-2.5-flash` (or whatever value is currently in `gateway/.env` — not `<unset>`).

- [ ] **Step 3: Update the dev script**

In `gateway/package.json`, change:

```json
    "dev": "tsx watch src/server.ts",
```

to:

```json
    "dev": "tsx watch --env-file=.env src/server.ts",
```

- [ ] **Step 4: Verify the updated script picks up `.env`**

Run:

```bash
cd gateway
timeout 3 env -u GEMINI_MODEL npm run dev 2>&1 | head -5
```

Expected: the server starts without a "GEMINI_MODEL" related crash (there isn't one today either — the point of this check is just that `npm run dev` no longer silently drops the values in `.env`). To directly confirm the flag is wired in, re-run the Step 2 command through the npm script instead of raw `tsx`:

```bash
cd gateway
env -u GEMINI_MODEL npx tsx watch --env-file=.env -e "console.log('GEMINI_MODEL:', process.env.GEMINI_MODEL ?? '<unset>'); process.exit(0)"
```

Expected: `GEMINI_MODEL: gemini-2.5-flash` (matches Step 2).

- [ ] **Step 5: Restart your local dev server**

Whichever terminal is currently running `npm run dev` for the gateway (the one this session found listening on `localhost:8787`) is still running the old script and does not have this fix. Stop it (Ctrl+C) and run `npm run dev` again so it picks up the new `--env-file` flag — this is required for Task 4 below to actually take effect.

- [ ] **Step 6: Commit**

```bash
git add gateway/package.json
git commit -m "fix: load gateway/.env automatically in the dev server"
```

---

### Task 4 (manual — requires a human with access to a Gemini API key): Add a real `GEMINI_API_KEY`

This is the step that actually unblocks voice transcription and AI analysis. Claude cannot do this step: it requires a real secret that only you can obtain and that must never be pasted into chat, committed to git, or typed by an AI agent.

- [ ] **Step 1: Get a key**

Get a Gemini API key from Google AI Studio (`https://aistudio.google.com/apikey`) if you don't already have one for this project.

- [ ] **Step 2: Add it to `gateway/.env`**

Open `gateway/.env` yourself and add (or fix) one line:

```
GEMINI_API_KEY=<your real key>
```

`gateway/.env` is already outside version control for this repo's secrets convention — do not add it to any commit.

- [ ] **Step 3: Restart the gateway dev server**

Same server as Task 3 Step 5 — stop and restart `npm run dev` in `gateway/` so the new `--env-file=.env` loading (Task 3) picks up the key.

- [ ] **Step 4: Confirm the key reached the process**

Run, from a separate terminal, while the gateway is running on its usual port:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787/api/v1/brain-dumps/voice \
  -H "Content-Type: audio/webm" --data-binary "not-real-audio-bytes"
```

Expected before this task: `404` (the route does not exist at all — `gateway/src/app.ts` only registers `transcriptionRoutes` when `config.geminiApiKey` is set).

Expected after this task: `401` (the route now exists and correctly rejects the request for missing auth, since this curl has no bearer token — that 401, not 404, is the proof the key reached the process and the route registered).

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full gateway suite**

Run: `cd gateway && npm run typecheck && npm run build && npm test -- --run`

Expected: all pass.

- [ ] **Step 2: Run the full frontend suite**

Run: `cd prototype && npm run build && npm test -- --run`

Expected: all pass.

- [ ] **Step 3: Live smoke test — voice**

With Task 4 complete and the gateway restarted, open the running app (`http://localhost:5173` or wherever the frontend dev server is bound), sign in, open Brain Dump, record a few seconds of Ukrainian speech, and stop the recording.

Expected: the recognized transcript appears in the editable transcript field (no "Не вдалося розпізнати запис" error). If it still fails, capture the exact gateway log line (`request.log.error` in `gateway/src/modules/transcription/transcriptionRoutes.ts:49-54` logs `provider: { status, code, message }`) before proposing a next fix — do not guess again.

- [ ] **Step 4: Live smoke test — manual text idea**

In the same session, open Brain Dump again, switch to text mode, type a short idea, and save it.

Expected: the app either reaches the AI result/clarification screen, or — if analysis is still degraded for some other reason — shows the corrected error from Task 1 ("Не вдалося зберегти..." only when the save itself failed, never when it didn't). Open Inbox and confirm the typed idea's draft is listed there, proving it reached PocketBase.

- [ ] **Step 5: Record the outcome**

Do not update `.superpowers/sdd/progress.md` or any other shared progress file as part of this plan (per the Global Constraints, this session does not touch the other worktree's in-progress paperwork). Instead, report the Step 3/4 results directly to the user.
