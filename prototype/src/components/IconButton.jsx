export function IconButton({ label, icon: Icon, variant = "quiet", ...props }) {
  return (
    <button className={`icon-button icon-button--${variant}`} aria-label={label} {...props}>
      <Icon size={22} weight="regular" aria-hidden />
    </button>
  );
}
