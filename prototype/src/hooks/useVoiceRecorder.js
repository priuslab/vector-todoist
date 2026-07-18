import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceRecorder({ onComplete } = {}) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const start = useCallback(async () => {
    if (!globalThis.MediaRecorder || !navigator?.mediaDevices?.getUserMedia) {
      setStatus("unsupported"); setError("Цей браузер не підтримує запис голосу. Напиши думки текстом."); return;
    }
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderOptions = MediaRecorder.isTypeSupported?.("audio/webm") ? { mimeType: "audio/webm" } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setStatus("idle"); onComplete?.(blob);
      };
      recorderRef.current = recorder; recorder.start(); setStatus("recording");
    } catch { setStatus("permission"); setError("Не вдалося отримати доступ до мікрофона. Дозволь запис або напиши думки текстом."); }
  }, [onComplete]);

  const stop = useCallback(() => { if (recorderRef.current && recorderRef.current.state !== "inactive") { setStatus("uploading"); recorderRef.current.stop(); recorderRef.current = null; } }, []);
  const cancel = useCallback(() => { if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop(); recorderRef.current = null; chunksRef.current = []; setStatus("idle"); }, []);
  const pause = useCallback(() => { if (recorderRef.current?.state === "recording") { recorderRef.current.pause(); setStatus("paused"); } else if (recorderRef.current?.state === "paused") { recorderRef.current.resume(); setStatus("recording"); } }, []);
  useEffect(() => () => cancel(), [cancel]);
  return { status, error, start, stop, cancel, pause, isRecording: status === "recording", isPaused: status === "paused" };
}
