import { ArrowRight } from "@phosphor-icons/react";

export function EntityCard({ label, title, meta, tone = "brand", onClick }) {
  return (
    <button className={`entity-card entity-card--${tone}`} onClick={onClick}>
      <span className="entity-card__label">{label}</span>
      <strong>{title}</strong>
      <span className="entity-card__meta">{meta}</span>
      <ArrowRight className="entity-card__arrow" size={18} aria-hidden />
    </button>
  );
}
