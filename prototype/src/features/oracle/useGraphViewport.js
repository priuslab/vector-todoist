import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_VIEWPORT = { x: 0, y: 0, scale: 1 };
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function useGraphViewport({ storageKey = "vector-oracle-viewport-v1" } = {}) {
  const [viewport, setViewport] = useState(() => {
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(storageKey) ?? "null");
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) && Number.isFinite(saved.scale)) {
        return { x: clamp(saved.x, -240, 240), y: clamp(saved.y, -240, 240), scale: clamp(saved.scale, 0.65, 1.8) };
      }
    } catch { /* local storage is optional */ }
    return DEFAULT_VIEWPORT;
  });
  const drag = useRef(null);

  useEffect(() => {
    try { globalThis.localStorage?.setItem(storageKey, JSON.stringify(viewport)); } catch { /* optional */ }
  }, [storageKey, viewport]);

  const reset = useCallback(() => setViewport(DEFAULT_VIEWPORT), []);
  const zoomBy = useCallback((delta) => setViewport((current) => ({ ...current, scale: clamp(Number((current.scale + delta).toFixed(2)), 0.65, 1.8) })), []);
  const beginPan = useCallback((event) => {
    if (event.target.closest?.("button")) return;
    drag.current = { clientX: event.clientX, clientY: event.clientY, x: viewport.x, y: viewport.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [viewport]);
  const pan = useCallback((event) => {
    if (!drag.current) return;
    setViewport((current) => ({ ...current, x: clamp(drag.current.x + event.clientX - drag.current.clientX, -240, 240), y: clamp(drag.current.y + event.clientY - drag.current.clientY, -240, 240) }));
  }, []);
  const endPan = useCallback(() => { drag.current = null; }, []);

  return { viewport, reset, zoomBy, beginPan, pan, endPan };
}
