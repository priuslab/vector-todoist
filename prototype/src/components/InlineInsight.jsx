import { Sparkle, WarningCircle } from "@phosphor-icons/react";

export function InlineInsight({ title = "AI-рекомендація", children, tone = "brand", action }) {
  const Icon = tone === "warning" ? WarningCircle : Sparkle;
  return (
    <aside className={`insight insight--${tone}`}>
      <Icon size={20} weight="fill" aria-hidden />
      <div><strong>{title}</strong><p>{children}</p>{action}</div>
    </aside>
  );
}
