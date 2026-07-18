export function LinearProgress({ value, label }) {
  return (
    <div className="progress-wrap">
      {label ? <div className="progress-label"><span>{label}</span><strong>{value}%</strong></div> : null}
      <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ value, label }) {
  return <div className="progress-ring" style={{ "--progress": `${value * 3.6}deg` }}><span>{value}%</span>{label ? <small>{label}</small> : null}</div>;
}
