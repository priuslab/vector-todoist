# Task 5 — Reuse the composer in Brain Dump

## Status

Complete. `CaptureFlow` now uses `VoiceTextComposer` as its voice-first entry
path. The composer transcribes through the existing voice endpoint, then hands
the result to the existing editable voice-review and Brain Dump save/analyze
flow.

## Preserved behavior

- Voice transcription posts to `/api/v1/brain-dumps/voice` with the existing
  request headers and blob body.
- The editable `voice-review` stage remains the point where an edited
  transcript is saved through `createBrainDump`.
- Voice transcription failures keep the existing retry path and text fallback.
- Text-only entry and save-failure recovery remain available through the
  composer.

## Tests

- `npm test -- --run src/features/capture/capture.test.jsx src/features/capture/capture-live.test.jsx`
  — 2 files, 6 tests passed.
- `npm run build` — passed.

## Concern

Vite continues to report the pre-existing main bundle-size warning (>500 kB);
the build still exits successfully.

## Review fix — voice retry guard

- Restored an in-flight guard for voice transcription in `CaptureFlow`; retry
  now shows loading and cannot start a second upload while the first is pending.
- The shared composer is disabled while transcription or Brain Dump saving is
  pending, including its voice, text, and mode-switch controls.
- Added a pending-promise regression test that retries a failed recording twice
  and verifies only one retry request is sent.

Verification:

- `npm test -- --run src/features/capture/capture.test.jsx src/features/capture/capture-live.test.jsx src/components/VoiceTextComposer.test.jsx` — 3 files, 16 tests passed.
- `npm run build` — passed; the existing Vite >500 kB bundle warning remains.
