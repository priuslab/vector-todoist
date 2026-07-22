# Task 4 report: voice-first goal interview answers

## Delivered

- Replaced the goal-interview textarea with the reusable voice-first `VoiceTextComposer`.
- Kept the existing interview question copy, answer persistence endpoint, result route, validation, and error copy.
- Sends recorded audio to `/api/v1/brain-dumps/voice` when an API client is available.
- Returns a Ukrainian demo transcript only when the router identifies a QA/demo environment; a non-demo client without an API falls back to the composer's editable text error path.
- Added an integration test for voice-first rendering, text switching, editing, explicit send, persistence, and the result transition.

## TDD and verification evidence

- RED: `npm test -- --run src/features/onboarding/goal-discovery.test.jsx` failed because the goal question did not render `Увімкнути текстовий режим`.
- GREEN: `npm test -- --run src/features/onboarding/goal-discovery.test.jsx src/features/goals/goal-discovery.test.jsx src/screens/ScreenRouter.test.jsx` — 3 files / 6 tests passed.
- Build: `npm run build` — passed. Vite emitted its existing chunk-size advisory only.
- `git diff --check` — no whitespace errors.

## Scope note

The composer owns the single explicit send control; the goal interview supplies the required `Відповісти` label, while the reusable default remains `Відправити`. Existing question-to-result routing remains unchanged.

## Review follow-up

- The interview composer now remounts by `question.id`, so each unanswered question begins with an empty voice-first draft.
- `VoiceTextComposer` accepts a host `submitLabel` (default `Відправити`) and a `disabled` submission state; GoalSetup supplies `Відповісти` and blocks repeat sends while its answer request is pending.
- RED: the new composer and multi-question integration tests failed because the host label, disabled behavior, and per-question remount were absent.
- GREEN: `npm test -- --run src/components/VoiceTextComposer.test.jsx src/features/onboarding/goal-discovery.test.jsx src/features/goals/goal-discovery.test.jsx src/screens/ScreenRouter.test.jsx` — 4 files / 17 tests passed.
- Build: `npm run build` — passed; only the existing Vite chunk-size advisory was emitted.
