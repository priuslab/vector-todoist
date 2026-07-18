import { ArrowCounterClockwise } from "@phosphor-icons/react";

export function UndoSnackbar({ message = "Зміни скасовано", onUndo }) {
  return (
    <div className="undo-snackbar" role="status">
      <span>{message}</span>
      {onUndo ? <button onClick={onUndo}><ArrowCounterClockwise size={17} aria-hidden />Скасувати</button> : null}
    </div>
  );
}
