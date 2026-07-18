// Простой бар-чарт на CSS: без клиентского JS, title = тултип.
export function Bars({
  points,
  accentLast = true,
  formatValue,
}: {
  points: { label: string; value: number }[];
  accentLast?: boolean;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="bars">
      {points.map((p, i) => (
        <div
          key={i}
          className={
            "bars__bar" +
            (accentLast && i === points.length - 1
              ? " bars__bar--accent"
              : p.value === 0
                ? " bars__bar--muted"
                : "")
          }
          style={{ height: `${Math.max(2, (p.value / max) * 100)}%` }}
          title={`${p.label}: ${formatValue ? formatValue(p.value) : p.value}`}
        />
      ))}
    </div>
  );
}
