// Weekly workload overview with per-day load bars, ported from the web card.
import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { classifyLoad, type DailyLoad, type LoadBand } from '@kibo/planning';
import { Card } from '../ui/primitives';
import { Icon } from '../ui/Icon';
import { colors } from '../theme/colors';
import { useDailyLoads } from '../hooks/useDailyLoad';
import { PlanMyDayModal } from './PlanMyDayModal';

const DOW_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

const BAND_COLORS: Record<LoadBand, string> = {
  rest: colors.border,
  low: '#34d399',
  normal: colors.accent,
  heavy: '#fbbf24',
  over: '#f43f5e',
};

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

function LoadBar({ load }: { load: DailyLoad }) {
  const band = classifyLoad(load);
  const pct = Math.round(load.loadPercentage * 100);
  const barPct = Math.min(100, pct);
  return (
    <View className="w-full items-center gap-1">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-kibo-bg">
        <View
          className="h-full rounded-full"
          style={{ width: `${barPct}%`, backgroundColor: BAND_COLORS[band] }}
        />
      </View>
      <Text className="text-[10px]" style={{ color: BAND_COLORS[band] }}>
        {load.isRestDay ? '—' : `${pct}%`}
      </Text>
    </View>
  );
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
    <Card className="p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon name="trending-up" size={14} color={colors.muted} />
          <Text className="text-sm font-medium text-kibo-text">Carga de la semana</Text>
        </View>
        <TouchableOpacity
          onPress={() => setPlanOpen(true)}
          activeOpacity={0.7}
          className="h-7 flex-row items-center gap-1.5 rounded-md border border-kibo-accent/40 bg-kibo-accentDeep/10 px-2.5"
        >
          <Icon name="zap" size={12} color={colors.accent} />
          <Text className="text-xs font-medium text-kibo-accent">Planificar mi día</Text>
        </TouchableOpacity>
      </View>

      {isOver ? (
        <View className="mb-3 flex-row items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
          <Icon name="alert-triangle" size={14} color="#fb7185" />
          <View className="flex-1">
            <Text className="text-xs text-rose-300">Hoy estás sobrecargado.</Text>
            <Text className="mt-0.5 text-xs text-kibo-muted">
              {fmtMinutes(
                todayLoad.scheduledTaskMinutes + todayLoad.eventMinutes - todayLoad.totalAvailableMinutes,
              )}{' '}
              por encima del horario. Considera mover tareas a un día más ligero.
            </Text>
          </View>
        </View>
      ) : null}

      {!isOver && isHeavy ? (
        <View className="mb-3 flex-row items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <Icon name="alert-triangle" size={14} color="#fbbf24" />
          <Text className="flex-1 text-xs text-amber-200">
            Hoy tienes un día cargado ({Math.round(todayLoad.loadPercentage * 100)}%). Solo{' '}
            {fmtMinutes(todayLoad.freeMinutes)} libres.
          </Text>
        </View>
      ) : null}

      <View className="flex-row gap-1.5">
        {dates.map((d, i) => {
          const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
          const load = loads.get(key);
          if (!load) return null;
          const isToday = i === 0;
          return (
            <View
              key={key}
              className={`flex-1 items-center gap-1 rounded-lg p-1.5 ${
                isToday ? 'border border-kibo-accent/30 bg-kibo-accentDeep/10' : 'bg-kibo-bg/40'
              }`}
            >
              <Text className="text-[9px] uppercase text-kibo-muted">{DOW_ES[d.getDay()]}</Text>
              <Text className="text-sm font-medium text-kibo-text">{d.getDate()}</Text>
              <LoadBar load={load} />
            </View>
          );
        })}
      </View>
      <PlanMyDayModal open={planOpen} onClose={() => setPlanOpen(false)} targetDate={today} />
    </Card>
  );
}
