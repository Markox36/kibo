import { AlertTriangle, Clock } from 'lucide-react';
import { useDeadlineWarnings } from '../hooks/useDeadlineWarnings';

function fmtMinutes(m: number): string {
  const total = Math.round(m);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

function daysLabel(n: number): string {
  if (n === 0) return 'vence hoy';
  if (n === 1) return 'vence mañana';
  return `vence en ${n} días`;
}

export function DeadlineWarningsCard() {
  const warnings = useDeadlineWarnings();
  if (warnings.length === 0) return null;
  const visible = warnings.slice(0, 4);
  const rest = warnings.length - visible.length;

  return (
    <section className="card p-4 border-rose-500/30 bg-rose-500/5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} className="text-rose-400" />
        <h3 className="text-sm font-medium text-rose-200">
          Deadlines en riesgo{warnings.length > 1 ? ` (${warnings.length})` : ''}
        </h3>
      </div>
      <ul className="space-y-2">
        {visible.map((w) => (
          <li
            key={w.taskId}
            className="flex items-start justify-between gap-3 rounded-lg bg-kibo-bg/40 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-kibo-text truncate">{w.taskTitle}</p>
              <p className="text-[11px] text-kibo-muted mt-0.5 flex items-center gap-1.5">
                <Clock size={10} /> Necesita {fmtMinutes(w.estimatedMinutes)} · libre{' '}
                {fmtMinutes(w.freeMinutesUntilDeadline)} · {daysLabel(w.daysUntilDeadline)}
              </p>
            </div>
            <span className="text-xs font-medium text-rose-300 tabular-nums shrink-0">
              −{fmtMinutes(w.deficitMinutes)}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="text-[11px] text-kibo-muted mt-3">
          y {rest} más con tiempo insuficiente antes del deadline.
        </p>
      )}
    </section>
  );
}
