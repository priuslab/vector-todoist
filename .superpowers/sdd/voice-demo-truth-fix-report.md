# Voice transcription truth fix report

## What changed

- Removed the local `DEMO_BRAIN_DUMP` substitution from the voice-recording path.
- When the app has no connected API client, a completed recording now opens a Ukrainian unavailable/retry state with a text-entry fallback instead of showing fabricated transcript prose.
- Kept API-backed transcription unchanged: a non-empty `/api/v1/brain-dumps/voice` transcript still opens the editable review screen.
- Centered the `Голосовий режим` label across the full composer width directly above the primary voice control.

## TDD evidence

Added a regression test proving that a local recording never displays the demo podcast text and instead offers the unavailable/text fallback. The new test failed before the implementation because the local flow rendered `DEMO_BRAIN_DUMP` as a transcript.

## Verification

```text
npm test -- --run src/features/capture/capture.test.jsx src/features/capture/capture-live.test.jsx src/components/VoiceTextComposer.test.jsx
→ 3 files passed, 22 tests passed

npm run build
→ passed
```

The Vite build retains its pre-existing chunk-size warning only.
