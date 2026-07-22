# Voice/Text Composer final review fixes

## Changes

- Added a synchronous `getUserMedia` in-flight guard to `useVoiceRecorder`, so a fast second tap cannot create a second recorder.
- Invalidated pending microphone requests on cancellation/unmount and release a late-resolving stream immediately.
- Exposed `isStarting` and disabled the voice controls while microphone access is pending.
- Kept the AI orb and live status in the error state during editable text fallback; the composer becomes a draft only after a valid transcript or a user edit.
- Disabled the submit CTA until the text draft has non-whitespace content.
- Made the reusable composer fill its centered mobile hosts with `width: 100%` and `min-width: 0`.

## Regression coverage

- Deferred microphone permission: double start makes one request, cancellation releases the late stream, and recording can be started again.
- Permission and transcription fallbacks retain the Ukrainian error status and error orb.
- Pending microphone access disables both voice controls.
- Error fallback becomes a draft after the user edits it.
- Empty and filled draft CTA states are asserted.

## Verification

```text
npm test -- --run src/features/capture/voice-live.test.jsx src/components/VoiceTextComposer.test.jsx src/features/capture/capture.test.jsx src/features/capture/capture-live.test.jsx
→ 4 files, 23 tests passed

npm run build
→ passed (known Vite chunk-size advisory only)

git diff --check
→ passed
```
