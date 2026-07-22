import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceRecorder({ onComplete } = {}) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const cancelledRef = useRef(false);
  const failedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const startInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const setStateIfMounted = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  const releaseStream = useCallback((stream) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    if (streamRef.current === stream) streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (startInFlightRef.current || recorderRef.current?.state === "recording" || recorderRef.current?.state === "paused") return;
    if (!globalThis.MediaRecorder || !navigator?.mediaDevices?.getUserMedia) {
      setStateIfMounted(setStatus, "unsupported");
      setStateIfMounted(setError, "Цей браузер не підтримує запис голосу. Напиши думки текстом.");
      return;
    }

    const requestVersion = ++requestVersionRef.current;
    let stream;
    startInFlightRef.current = true;
    setStateIfMounted(setIsStarting, true);

    try {
      setStateIfMounted(setError, "");
      cancelledRef.current = false;
      failedRef.current = false;
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!mountedRef.current || cancelledRef.current || requestVersion !== requestVersionRef.current) {
        releaseStream(stream);
        return;
      }

      streamRef.current = stream;
      const recorderOptions = MediaRecorder.isTypeSupported?.("audio/webm") ? { mimeType: "audio/webm" } : undefined;
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];
      setStateIfMounted(setElapsedSeconds, 0);
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseStream(stream);
        if (recorderRef.current === recorder) recorderRef.current = null;
        if (failedRef.current || !mountedRef.current) return;
        if (cancelledRef.current) {
          chunksRef.current = [];
          setStatus("idle");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setStatus("idle");
        onComplete?.(blob);
      };
      recorder.onerror = () => {
        cancelledRef.current = true;
        failedRef.current = true;
        chunksRef.current = [];
        releaseStream(stream);
        if (recorderRef.current === recorder) recorderRef.current = null;
        setStateIfMounted(setError, "Сталася помилка мікрофона. Спробуй ще раз або напиши думки текстом.");
        setStateIfMounted(setStatus, "error");
      };
      recorderRef.current = recorder;
      recorder.start();
      setStateIfMounted(setStatus, "recording");
    } catch {
      releaseStream(stream);
      if (mountedRef.current && !cancelledRef.current && requestVersion === requestVersionRef.current) {
        setStatus("permission");
        setError("Не вдалося отримати доступ до мікрофона. Дозволь запис або напиши думки текстом.");
      }
    } finally {
      startInFlightRef.current = false;
      setStateIfMounted(setIsStarting, false);
    }
  }, [onComplete, releaseStream, setStateIfMounted]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      setStateIfMounted(setStatus, "uploading");
      const recorder = recorderRef.current;
      recorderRef.current = null;
      recorder.stop();
    }
  }, [setStateIfMounted]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    requestVersionRef.current += 1;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    releaseStream(streamRef.current);
    chunksRef.current = [];
    setStateIfMounted(setStatus, "idle");
  }, [releaseStream, setStateIfMounted]);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setStateIfMounted(setStatus, "paused");
    } else if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setStateIfMounted(setStatus, "recording");
    }
  }, [setStateIfMounted]);

  useEffect(() => {
    if (status !== "recording") return undefined;
    const startedAt = Date.now() - elapsedSeconds * 1000;
    const timer = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1_000);
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancel();
    };
  }, [cancel]);

  return {
    status,
    error,
    elapsedSeconds,
    start,
    stop,
    cancel,
    pause,
    isStarting,
    isRecording: status === "recording",
    isPaused: status === "paused",
  };
}
