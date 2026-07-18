import { CheckCircle, CloudSlash, WarningCircle } from "@phosphor-icons/react";

const icons = { success: CheckCircle, error: WarningCircle, offline: CloudSlash, empty: SparkleIcon };

function SparkleIcon(props) {
  return <CheckCircle {...props} />;
}

export function StateView({ state = "empty", title, message, action }) {
  const Icon = icons[state] ?? WarningCircle;
  return (
    <section className={`state-view state-view--${state}`}>
      <span className="state-view__icon"><Icon size={32} weight="duotone" aria-hidden /></span>
      <h2>{title}</h2>
      <p>{message}</p>
      {action}
    </section>
  );
}
