# Voice composer permission fallback regression fix

## Root cause

The permission-denial path is asynchronous: `getUserMedia()` rejects after the user starts recording, and the composer switches to editable text through the recorder status effect. The existing test queried the textbox synchronously immediately after clicking the microphone. It passed with an immediately rejected mock but failed when permission resolution was delayed, even though the production fallback completed correctly.

## Red / green evidence

- Replaced the immediate rejection with a 50 ms delayed `NotAllowedError` while keeping the synchronous query. The focused test failed with `Unable to find an accessible element with the role "textbox"` and displayed the expected intermediate `Слухаю` state.
- Changed the assertion to `await screen.findByRole("textbox")`, preserving the behavior contract while waiting for the asynchronous browser permission result.

## Verification

```text
npm test -- --run src/components/VoiceTextComposer.test.jsx src/features/capture/voice-live.test.jsx
→ 2 files, 16 tests passed

npm test -- --run
→ 35 files, 126 tests passed

npm run build
→ passed (known Vite chunk-size advisory only)

git diff --check
→ passed
```
