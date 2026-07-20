# Voice UI and transcript fix report

## Root cause

`CaptureFlow` transitioned to the editable transcript screen even when the voice endpoint returned no usable `transcript`. That unmounted the composer-level fallback and left the review textarea empty. The capture draft also started with the product's demo Brain Dump, so an example could appear in a text field without being identified as an example.

## Changes

- Voice mode now applies reusable hero classes: the AI orb is large and centered, with its status copy centered beneath it. Text mode keeps the compact surface.
- Capture validates and trims the endpoint transcript before changing to the review stage. Missing or empty text now follows the existing retry/error path.
- A successful real transcription is placed into the editable review textarea. The no-API fallback remains available for the prototype, but it is explicitly labelled `Демо-транскрипт`.
- The initial capture draft is empty, so opening manual text entry does not prefill a demo Brain Dump.

## Verification

```text
npm test -- --run src/components/VoiceTextComposer.test.jsx src/features/capture/capture.test.jsx src/features/capture/capture-live.test.jsx
21 passed

npm run build
passed (known Vite bundle-size warning only)
```

Added regression coverage for the hero class, exact real-transcript population, and the missing-transcript retry path.
