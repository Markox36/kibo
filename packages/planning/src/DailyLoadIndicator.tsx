import type { DailyLoad, LoadBand } from './load.js';
import { classifyLoad } from './load.js';

const BAND_STYLES: Record<LoadBand, { bar: string; text: string; label: string }> = {
  rest: { bar: 'bg-kibo-border', text: 'text-kibo-muted', label: 'Descanso' },
  low: { bar: 'bg-emerald-500/80', text: 'text-emerald-400', label: 'Ligero' },
  normal: { bar: 'bg-kibo-accent/80', text: 'text-kibo-accent', label: 'Normal' },
  heavy: { bar: 'bg-amber-500/80', text: 'text-amber-400', label: 'Cargado' },
  over: { bar: 'bg-rose-500', text: 'text-rose-400', label: 'Sobrecargado' },
};

function fmtMinutes(m: number): string {
  const total = Math.round(m);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

export function DailyLoadIndicator({ load }: { load: DailyLoad }) {
  const band = classifyLoad(load);
  const style = BAND_STYLES[band];
  const pct = Math.round(load.loadPercentage * 100);
  const barPct = Math.min(100, pct);
  const tooltipLines: string[] = [];
  if (load.isRestDay) {
    tooltipLines.push('Día de descanso');
  } else {
    tooltipLines.push(`${style.label} · ${pct}% de carga`);
    tooltipLines.push(`Tareas: ${fmtMinutes(load.scheduledTaskMinutes)}`);
    tooltipLines.push(`Eventos: ${fmtMinutes(load.eventMinutes)}`);
    tooltipLines.push(`Libre: ${fmtMinutes(load.freeMinutes)}`);
    if (band === 'over') {
      const excess = load.scheduledTaskMinutes + load.eventMinutes - load.totalAvailableMinutes;
      tooltipLines.push(`Exceso: ${fmtMinutes(excess)}`);
    }
  }
  return (
    <div
      className="kibo-load"
      title={tooltipLines.join('\n')}
      aria-label={tooltipLines.join('. ')}
    >
      <div className="kibo-load-bar-track">
        <div className={`kibo-load-bar-fill ${style.bar}`} style={{ width: `${barPct}%` }} />
      </div>
      <span className={`kibo-load-pct tabular-nums ${style.text}`}>
        {load.isRestDay ? '—' : `${pct}%`}
      </span>
    </div>
  );
}
