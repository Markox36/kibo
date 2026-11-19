import { useMemo, useState } from 'react';
import { classifyLoad, DailyLoadIndicator } from '@kibo/planning';
import { AlertTriangle, Sparkles, TrendingUp } from 'lucide-react';
import { useDailyLoads } from '../hooks/useDailyLoad';
import { PlanMyDayModal } from './PlanMyDayModal';

const DOW_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

function nextDays(count: number, from: Date = new Date()): Date[] {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const out: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

function fmtMinutes(m: number): string {
  const total = Math.round(m);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const mm = total % 60;
  return mm === 0 ? `${h}h` : `${h}h ${mm}m`;
}

export function WorkloadCard() {
  const dates = useMemo(() => nextDays(7), []);
  const loads = useDailyLoads(dates);
  const [planOpen, setPlanOpen] = useState(false);
  const today = dates[0]!;
  const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
  const todayLoad = loads.get(todayKey);
  if (!todayLoad) return null;

  const band = classifyLoad(todayLoad);
  const isOver = band === 'over';
  const isHeavy = band === 'heavy';

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-kibo-muted" />
          <h3 className="text-sm font-medium">Carga de la semana</h3>
        </div>
        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-kibo-accent/40 bg-kibo-accent/10 text-kibo-accent hover:bg-kibo-accent/20 text-xs font-medium transition-colors"
        >
          <Sparkles size={12} /> Planificar mi día
        </button>
      </div>

      {isOver && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs">
          <AlertTriangle size={14} className="text-rose-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-rose-300">Hoy estás sobrecargado.</p>
            <p className="text-kibo-muted mt-0.5">
              {fmtMinutes(
                todayLoad.scheduledTaskMinutes + todayLoad.eventMinutes - todayLoad.totalAvailableMinutes,
              )}{' '}
              por encima del horario. Considera mover tareas a un día más ligero.
            </p>
          </div>
        </div>
      )}

      {!isOver && isHeavy && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
          <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-amber-200">
            Hoy tienes un día cargado ({Math.round(todayLoad.loadPercentage * 100)}%). Solo{' '}
            {fmtMinutes(todayLoad.freeMinutes)} libres.
          </p>
        </div>
      )}

      <div className="grid grid-cols-7 gap-2">
        {dates.map((d, i) => {
          const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          const load = loads.get(key);
          if (!load) return null;
          const isToday = i === 0;
          return (
            <div
              key={key}
              className={
                'flex flex-col items-center gap-1 rounded-lg p-2 ' +
                (isToday ? 'bg-kibo-accent/10 border border-kibo-accent/30' : 'bg-kibo-bg/40')
              }
            >
              <div className="text-[10px] uppercase tracking-wider text-kibo-muted">
                {DOW_ES[d.getDay()]}
              </div>
              <div className="text-sm font-medium tabular-nums">{d.getDate()}</div>
              <DailyLoadIndicator load={load} />
            </div>
          );
        })}
      </div>
      <PlanMyDayModal open={planOpen} onClose={() => setPlanOpen(false)} targetDate={today} />
    </section>
  );
}
