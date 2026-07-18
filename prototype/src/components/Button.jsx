import { CircleNotch } from "@phosphor-icons/react";

export function Button({
  children,
  variant = "primary",
  loading = false,
  icon: Icon,
  className = "",
  ...props
}) {
  return (
    <button
      className={`button button--${variant} ${className}`.trim()}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <CircleNotch className="spin" size={20} aria-hidden /> : Icon ? <Icon size={20} aria-hidden /> : null}
      <span>{children}</span>
    </button>
  );
}
