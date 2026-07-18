export function SegmentedControl({ items, value, onChange, label = "Режим" }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} className={item.value === value ? "is-active" : ""} onClick={() => onChange(item.value)}>{item.label}</button>
      ))}
    </div>
  );
}
