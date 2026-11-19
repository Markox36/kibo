import { useForm, Controller } from 'react-hook-form';
import { useEffect, useMemo, useState } from 'react';
import { Trash2, MapPin, AlignLeft, Bell, CalendarDays, Clock } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Modal } from './Modal';
import { MarkdownEditor } from '@kibo/editor';
import type { CalendarDto, EventDto } from '../lib/entities-api';
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from '../hooks/useEvents';

const REMINDERS = [
  { v: 'none', label: 'Ninguno' },
  { v: 'at_time', label: 'A la hora' },
  { v: '5m_before', label: '5 min antes' },
  { v: '15m_before', label: '15 min antes' },
  { v: '1h_before', label: '1 hora antes' },
  { v: '1d_before', label: '1 día antes' },
] as const;

const Schema = z
  .object({
    title: z.string().min(1, 'Título requerido').max(500),
    calendarId: z.string().min(1, 'Elige un calendario'),
    allDay: z.boolean(),
    startDate: z.string().min(1),
    startTime: z.string(),
    endDate: z.string().min(1),
    endTime: z.string(),
    location: z.string().max(500).optional(),
    reminder: z.string(),
    description: z.string().max(20_000).optional(),
  })
  .refine(
    (v) => {
      const s = new Date(v.allDay ? `${v.startDate}T00:00:00` : `${v.startDate}T${v.startTime}`);
      const e = new Date(v.allDay ? `${v.endDate}T23:59:59` : `${v.endDate}T${v.endTime}`);
      return e.getTime() >= s.getTime();
    },
    { message: 'La fecha de fin debe ser posterior', path: ['endTime'] },
  );

type FormValues = z.infer<typeof Schema>;

export interface EventFormInitial {
  id?: string;
  title?: string;
  calendarId?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
  reminder?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial: EventFormInitial | null;
  calendars: CalendarDto[];
  onEnsureCalendar: () => Promise<string>;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
function toDatePart(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimePart(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventFormModal({ open, onClose, initial, calendars, onEnsureCalendar }: Props) {
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const remove = useDeleteEvent();
  const [busy, setBusy] = useState(false);

  const defaults = useMemo<FormValues>(() => {
    const start = initial?.start ?? new Date();
    const end = initial?.end ?? new Date(start.getTime() + 60 * 60 * 1000);
    return {
      title: initial?.title ?? '',
      calendarId: initial?.calendarId ?? calendars.find((c) => c.isDefault)?.id ?? calendars[0]?.id ?? '',
      allDay: initial?.allDay ?? false,
      startDate: toDatePart(start),
      startTime: toTimePart(start),
      endDate: toDatePart(end),
      endTime: toTimePart(end),
      location: initial?.location ?? '',
      reminder: initial?.reminder ?? 'none',
      description: initial?.description ?? '',
    };
  }, [initial, calendars]);

  const form = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const allDay = form.watch('allDay');
  const isEdit = Boolean(initial?.id);

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true);
    try {
      let calId = v.calendarId;
      if (!calId) calId = await onEnsureCalendar();

      const start = new Date(v.allDay ? `${v.startDate}T00:00:00` : `${v.startDate}T${v.startTime}`);
      const end = new Date(v.allDay ? `${v.endDate}T23:59:59` : `${v.endDate}T${v.endTime}`);

      const payload = {
        title: v.title.trim(),
        calendarId: calId,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: v.allDay,
        location: v.location?.trim() || null,
        description: v.description?.trim() || null,
        reminder: v.reminder,
      };

      if (isEdit && initial?.id) {
        await update.mutateAsync({ id: initial.id, ...payload });
        toast.success('Evento actualizado.');
      } else {
        await create.mutateAsync(payload as never);
        toast.success('Listo, evento creado.');
      }
      onClose();
    } catch {
      toast.error(isEdit ? 'No se pudo actualizar.' : 'No se pudo crear.');
    } finally {
      setBusy(false);
    }
  });

  const onDelete = async () => {
    if (!initial?.id) return;
    setBusy(true);
    try {
      await remove.mutateAsync(initial.id);
      toast.success('Evento eliminado.');
      onClose();
    } catch {
      toast.error('No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  };

  const errors = form.formState.errors;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar evento' : 'Nuevo evento'}
      description={isEdit ? 'Modifica los detalles del evento.' : 'Añade título, hora y calendario.'}
      size="md"
      footer={
        <>
          {isEdit && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="mr-auto inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 h-8 px-2 rounded-md"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-outline h-8 text-xs px-3">
            Cancelar
          </button>
          <button type="submit" form="event-form" disabled={busy} className="btn-primary h-8 text-xs px-3">
            {busy ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
          </button>
        </>
      }
    >
      <form id="event-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <input
            {...form.register('title')}
            autoFocus
            placeholder="Añade un título"
            className="w-full bg-transparent outline-none text-lg font-medium placeholder:text-kibo-muted border-b border-transparent focus:border-kibo-accent pb-2"
          />
          {errors.title && (
            <span className="block text-xs text-red-400 mt-1">{errors.title.message}</span>
          )}
        </div>

        <IconRow icon={CalendarDays}>
          <Controller
            control={form.control}
            name="calendarId"
            render={({ field }) => {
              const current = calendars.find((c) => c.id === field.value);
              return (
                <div className="flex-1 flex items-center gap-2">
                  {current && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: current.color }}
                    />
                  )}
                  <select {...field} className="input h-8 text-sm flex-1">
                    {calendars.length === 0 && <option value="">Personal (se creará)</option>}
                    {calendars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }}
          />
        </IconRow>

        <IconRow icon={Clock}>
          <label className="flex items-center gap-2 text-xs text-kibo-muted">
            <input
              type="checkbox"
              {...form.register('allDay')}
              className="accent-kibo-accent"
            />
            Todo el día
          </label>
        </IconRow>

        <IconRow icon={Clock}>
          <div className="grid grid-cols-2 gap-2 flex-1">
            <input type="date" {...form.register('startDate')} className="input h-8 text-sm" />
            {!allDay && (
              <input type="time" {...form.register('startTime')} className="input h-8 text-sm" />
            )}
          </div>
        </IconRow>

        <IconRow icon={Clock}>
          <div className="grid grid-cols-2 gap-2 flex-1">
            <input type="date" {...form.register('endDate')} className="input h-8 text-sm" />
            {!allDay && (
              <input type="time" {...form.register('endTime')} className="input h-8 text-sm" />
            )}
          </div>
          {errors.endTime && (
            <span className="block text-xs text-red-400 mt-1">{errors.endTime.message}</span>
          )}
        </IconRow>

        <IconRow icon={MapPin}>
          <input
            {...form.register('location')}
            placeholder="Ubicación (opcional)"
            className="input h-8 text-sm flex-1"
          />
        </IconRow>

        <IconRow icon={Bell}>
          <select {...form.register('reminder')} className="input h-8 text-sm flex-1">
            {REMINDERS.map((r) => (
              <option key={r.v} value={r.v}>
                {r.label}
              </option>
            ))}
          </select>
        </IconRow>

        <IconRow icon={AlignLeft} align="start">
          <MarkdownEditor
            value={form.watch('description') ?? ''}
            onChange={(v) => form.setValue('description', v, { shouldDirty: true })}
            placeholder="Descripción en Markdown (opcional)"
            rows={4}
            textareaClassName="input min-h-[80px] text-sm flex-1 py-2 resize-y"
            className="flex-1"
          />
        </IconRow>
      </form>
    </Modal>
  );
}

function IconRow({
  icon: Icon,
  children,
  align = 'center',
}: {
  icon: typeof MapPin;
  children: React.ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className={'flex gap-3 ' + (align === 'start' ? 'items-start' : 'items-center')}>
      <Icon size={16} className={'text-kibo-muted shrink-0 ' + (align === 'start' ? 'mt-2' : '')} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
