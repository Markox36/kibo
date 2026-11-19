import { useEffect } from 'react';
import { toast } from 'sonner';
import { useFocus, phaseLabel, type FocusPhase } from '../store/focus';
import { notify, currentPermission } from '../lib/notifications';

function messageFor(next: FocusPhase): { title: string; body: string } {
  if (next === 'work')
    return { title: '🎯 Vuelta al trabajo', body: 'Se acabó el descanso. A concentrarse.' };
  if (next === 'short_break')
    return { title: '☕ Descanso corto', body: 'Levantate, respirá, hidratate.' };
  return { title: '🌿 Descanso largo', body: 'Bloque completo. Descansá bien.' };
}

export function useFocusTicker(): void {
  const tick = useFocus((s) => s.tick);
  const phase = useFocus((s) => s.phase);

  useEffect(() => {
    if (phase === 'idle') return;
    const id = window.setInterval(() => {
      const nextPhase = tick(Date.now());
      if (nextPhase) {
        const { title, body } = messageFor(nextPhase);
        if (currentPermission() === 'granted') notify({ title, body, tag: `focus:${nextPhase}` });
        toast(title, { description: `${body} · ${phaseLabel(nextPhase)}` });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, tick]);
}
