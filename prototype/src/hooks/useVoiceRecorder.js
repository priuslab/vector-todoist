import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceRecorder({ onComplete } = {}) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelledRef = useRef(false);
  const [status, setStatus] = useState("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");

  const start = useCallback(async () => {
    if (!globalThis.MediaRecorder || !navigator?.mediaDevices?.getUserMedia) {
      setStatus("unsupported"); setError("Цей браузер не підтримує запис голосу. Напиши думки текстом."); return;
    }
    try {
      setError("");
      cancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderOptions = MediaRecorder.isTypeSupported?.("audio/webm") ? { mimeType: "audio/webm" } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = []; setElapsedSeconds(0);
      recorder.ondataavailable = (event) => { if (event.data?.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (cancelledRef.current) { chunksRef.current = []; setStatus("idle"); return; }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setStatus("idle"); onComplete?.(blob);
      };
      recorderRef.current = recorder; recorder.start(); setStatus("recording");
    } catch { setStatus("permission"); setError("Не вдалося отримати доступ до мікрофона. Дозволь запис або напиши думки текстом."); }
  }, [onComplete]);

  const stop = useCallback(() => { if (recorderRef.current && recorderRef.current.state !== "inactive") { setStatus("uploading"); recorderRef.current.stop(); recorderRef.current = null; } }, []);
  const cancel = useCallback(() => { cancelledRef.current = true; if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop(); recorderRef.current = null; chunksRef.current = []; setStatus("idle"); }, []);
  const pause = useCallback(() => { if (recorderRef.current?.state === "recording") { recorderRef.current.pause(); setStatus("paused"); } else if (recorderRef.current?.state === "paused") { recorderRef.current.resume(); setStatus("recording"); } }, []);
  useEffect(() => {
    if (status !== "recording") return undefined;
    const startedAt = Date.now() - elapsedSeconds * 1000;
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
    return () => clearInterval(timer);
  }, [status]);
  useEffect(() => () => cancel(), [cancel]);
  return { status, error, elapsedSeconds, start, stop, cancel, pause, isRecording: status === "recording", isPaused: status === "paused" };
}
