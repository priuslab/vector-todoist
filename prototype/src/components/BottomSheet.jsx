import { X } from "@phosphor-icons/react";
import { IconButton } from "./IconButton";

export function BottomSheet({ title, children, onClose, actions }) {
  return (
    <div className="sheet-backdrop">
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="bottom-sheet__grab" />
        <header>
          <h2>{title}</h2>
          {onClose ? <IconButton label="Закрити" icon={X} onClick={onClose} /> : null}
        </header>
        <div className="bottom-sheet__content">{children}</div>
        {actions ? <footer>{actions}</footer> : null}
      </section>
    </div>
  );
}
