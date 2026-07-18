import { ArrowCounterClockwise } from "@phosphor-icons/react";

export function UndoSnackbar({ message, onUndo }) {
  return (
    <div className="undo-snackbar" role="status">
      <span>{message}</span>
      <button onClick={onUndo}><ArrowCounterClockwise size={17} aria-hidden />Скасувати</button>
    </div>
  );
}
