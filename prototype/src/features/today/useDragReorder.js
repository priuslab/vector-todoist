import { useCallback, useRef, useState } from "react";

const LONG_PRESS_MS = 300;
const SCROLL_CANCEL_PX = 8;

function addMinutesIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/**
 * Pure function: computes the new plannedStart/plannedEnd for a task dropped
 * at `dropIndex` within the list of tasks minus the dragged task itself.
 *
 * @param {object} params
 * @param {Array} params.tasks - current task order (includes the dragged task)
 * @param {string} params.taskId - id of the task being dropped
 * @param {number} params.dropIndex - index within the anchors list (tasks with the
 *   dragged task removed) where the dragged task should land
 * @param {string} params.date - local date "YYYY-MM-DD" used when dropped first
 * @returns {{ plannedStart: string, plannedEnd: string }}
 */
export function computeDropPlannedTimes({ tasks, taskId, dropIndex, date }) {
  const dragged = tasks.find((task) => task.id === taskId);
  const anchors = tasks.filter((task) => task.id !== taskId);
  const minutes = dragged?.estimatedMinutes ?? 30;
  const clampedIndex = Math.max(0, Math.min(dropIndex, anchors.length));
  const previousAnchor = clampedIndex > 0 ? anchors[clampedIndex - 1] : null;
  const plannedStart = previousAnchor?.plannedEnd ?? `${date}T09:00:00`;
  const plannedEnd = addMinutesIso(plannedStart, minutes);
  return { plannedStart, plannedEnd };
}

/**
 * Touch drag-and-drop reordering for the Today timeline list.
 * Long-press (300ms, <=8px movement) lifts a card; dragging moves it
 * vertically over sibling cards; releasing calls onReorder(taskId, newPlannedStartISO).
 *
 * Locked/completed tasks cannot be dragged but remain position anchors.
 */
export function useDragReorder({ tasks, onReorder, date, isDraggable }) {
  const [dragState, setDragState] = useState(null); // { taskId, index, offsetY, order }
  const cardRefs = useRef(new Map());
  const containerRef = useRef(null);
  const longPressTimer = useRef(null);
  const pressStart = useRef(null);
  const activePointerId = useRef(null);
  const measurementsRef = useRef([]);
  const orderRef = useRef([]);
  const touchMoveListenerRef = useRef(null);

  const registerCardRef = useCallback((taskId) => (node) => {
    if (node) cardRefs.current.set(taskId, node);
    else cardRefs.current.delete(taskId);
  }, []);

  const cleanupTouchMoveListener = useCallback(() => {
    if (touchMoveListenerRef.current) {
      document.removeEventListener("touchmove", touchMoveListenerRef.current);
      touchMoveListenerRef.current = null;
    }
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const endDrag = useCallback((commit) => {
    clearLongPressTimer();
    cleanupTouchMoveListener();
    const state = dragState;
    activePointerId.current = null;
    pressStart.current = null;
    setDragState(null);
    if (commit && state) {
      const anchors = orderRef.current.filter((id) => id !== state.taskId);
      const dropIndex = orderRef.current.indexOf(state.taskId);
      const clampedIndex = Math.min(dropIndex, anchors.length);
      const anchorTasks = anchors.map((id) => tasks.find((task) => task.id === id)).filter(Boolean);
      const { plannedStart } = computeDropPlannedTimes({
        tasks: [...anchorTasks, tasks.find((task) => task.id === state.taskId)].filter(Boolean),
        taskId: state.taskId,
        dropIndex: clampedIndex,
        date,
      });
      if (orderRef.current.join("|") !== tasks.map((task) => task.id).join("|")) {
        onReorder?.(state.taskId, plannedStart);
      }
    }
  }, [clearLongPressTimer, cleanupTouchMoveListener, dragState, onReorder, tasks, date]);

  const onPointerMove = useCallback((event) => {
    if (!pressStart.current) return;
    const dx = event.clientX - pressStart.current.x;
    const dy = event.clientY - pressStart.current.y;

    if (!dragState) {
      // Still waiting for long press to fire; cancel lift if this looks like a scroll.
      if (Math.hypot(dx, dy) > SCROLL_CANCEL_PX) {
        clearLongPressTimer();
        pressStart.current = null;
      }
      return;
    }

    const measurements = measurementsRef.current;
    const draggedMeasurement = measurements.find((m) => m.id === dragState.taskId);
    if (!draggedMeasurement) return;
    const pointerY = event.clientY;

    // Determine new order by comparing pointer position against sibling midpoints.
    const others = measurements.filter((m) => m.id !== dragState.taskId);
    let insertIndex = others.length;
    for (let i = 0; i < others.length; i += 1) {
      if (pointerY < others[i].top + others[i].height / 2) {
        insertIndex = i;
        break;
      }
    }
    const newOrder = others.map((m) => m.id);
    newOrder.splice(insertIndex, 0, dragState.taskId);
    orderRef.current = newOrder;

    setDragState((current) => current && { ...current, offsetY: dy, order: newOrder });
  }, [clearLongPressTimer, dragState]);

  const onPointerUp = useCallback(() => {
    endDrag(true);
  }, [endDrag]);

  const onPointerCancel = useCallback(() => {
    endDrag(false);
  }, [endDrag]);

  const startDrag = useCallback((taskId) => {
    const node = cardRefs.current.get(taskId);
    if (!node) return;
    const measurements = tasks
      .map((task) => {
        const el = cardRefs.current.get(task.id);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { id: task.id, top: rect.top, height: rect.height };
      })
      .filter(Boolean);
    measurementsRef.current = measurements;
    orderRef.current = tasks.map((task) => task.id);

    if (navigator.vibrate) navigator.vibrate(10);

    const handleTouchMove = (event) => {
      event.preventDefault();
    };
    touchMoveListenerRef.current = handleTouchMove;
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    setDragState({ taskId, offsetY: 0, order: orderRef.current });
  }, [tasks]);

  const onPointerDown = useCallback((task) => (event) => {
    if (!isDraggable?.(task)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointerId.current = event.pointerId;
    pressStart.current = { x: event.clientX, y: event.clientY };
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      if (pressStart.current) startDrag(task.id);
    }, LONG_PRESS_MS);
  }, [clearLongPressTimer, isDraggable, startDrag]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === "Escape" && dragState) {
      endDrag(false);
    }
  }, [dragState, endDrag]);

  const getCardProps = useCallback((task) => {
    const draggable = isDraggable?.(task);
    const isDragging = dragState?.taskId === task.id;
    const style = isDragging
      ? { transform: `translateY(${dragState.offsetY}px)`, zIndex: 2 }
      : undefined;
    return {
      ref: registerCardRef(task.id),
      className: isDragging ? "is-dragging" : "",
      style,
      onPointerDown: draggable ? onPointerDown(task) : undefined,
      onPointerMove: draggable ? onPointerMove : undefined,
      onPointerUp: draggable ? onPointerUp : undefined,
      onPointerCancel: draggable ? onPointerCancel : undefined,
      onKeyDown: draggable ? handleKeyDown : undefined,
    };
  }, [dragState, isDraggable, onPointerCancel, onPointerDown, onPointerMove, onPointerUp, handleKeyDown, registerCardRef]);

  const displayOrder = dragState?.order ?? tasks.map((task) => task.id);
  const isDragging = Boolean(dragState);

  return {
    containerRef,
    getCardProps,
    displayOrder,
    isDragging,
    draggingTaskId: dragState?.taskId ?? null,
  };
}
