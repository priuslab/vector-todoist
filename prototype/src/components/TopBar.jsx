import { ArrowLeft, DotsThree } from "@phosphor-icons/react";
import { IconButton } from "./IconButton";

export function TopBar({ title, eyebrow, onBack, trailing, avatar = false }) {
  return (
    <header className="topbar">
      <div className="topbar__side">
        {onBack ? <IconButton label="Назад" icon={ArrowLeft} onClick={onBack} /> : avatar ? <button className="avatar" aria-label="Відкрити профіль">ОК</button> : null}
      </div>
      <div className="topbar__title">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <strong>{title}</strong>
      </div>
      <div className="topbar__side topbar__side--right">
        {trailing ?? <IconButton label="Більше" icon={DotsThree} />}
      </div>
    </header>
  );
}
