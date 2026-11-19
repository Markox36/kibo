import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  AlignLeft,
  Bell,
  CalendarDays,
  Clock,
  Flag,
  Repeat,
  Trash2,
  Zap,
} from 'lucide-react';
import { Modal } from './Modal';
import { MarkdownEditor } from '@kibo/editor';
import type { TaskDto } from '../lib/entities-api';
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/useTasks';

const STATUSES = [
  { v: 'inbox', label: 'Inbox' },
  { v: 'pending', label: 'Pendiente' },
  { v: 'in_progress', label: 'En progreso' },
  { v: 'blocked', label: 'Bloqueada' },
  { v: 'done', label: 'Hecha' },
  { v: 'cancelled', label: 'Cancelada' },
] as const;

const PRIORITIES = [
  { v: 'low', label: 'Baja', dot: 'bg-neutral-500' },
  { v: 'medium', label: 'Media', dot: 'bg-amber-400' },
  { v: 'high', label: 'Alta', dot: 'bg-red-400' },
] as const;

const ENERGIES = [
  { v: '', label: '—' },
  { v: 'low', label: 'Baja' },
  { v: 'medium', label: 'Media' },
  { v: 'high', label: 'Alta' },
] as const;

const RECURRENCES = [
  { v: 'none', label: 'Sin repetición' },
  { v: 'daily', label: 'Diaria' },
  { v: 'weekly', label: 'Semanal' },
  { v: 'monthly', label: 'Mensual' },
] as const;

const REMINDERS = [
  { v: 'none', label: 'Ninguno' },
  { v: 'at_time', label: 'A la hora' },
  { v: '5m_before', label: '5 min antes' },
  { v: '15m_before', label: '15 min antes' },
  { v: '1h_before', label: '1 hora antes' },
  { v: '1d_before', label: '1 día antes' },
] as const;

const Schema = z.object({
  title: z.string().min(1, 'Título requerido').max(500),
  description: z.string().max(20_000).optional(),
  status: z.enum(['inbox', 'pending', 'in_progress', 'blocked', 'done', 'cancelled']),
  priority: z.enum(['low', 'medium', 'high']),
  energy: z.string().optional(),
  plannedDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedMinutes: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']),
  reminder: z.string(),
});

type FormValues = z.infer<typeof Schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  task: TaskDto | null;
}

export function TaskFormModal({ open, onClose, task }: Props) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const defaults = useMemo<FormValues>(
    () => ({
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: (task?.status as FormValues['status']) ?? 'pending',
      priority: (task?.priority as FormValues['priority']) ?? 'medium',
      energy: task?.energy ?? '',
      plannedDate: task?.plannedDate ?? '',
      dueDate: task?.dueDate ?? '',
      estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : '',
      recurrence: 'none',
      reminder: 'none',
    }),
    [task],
  );

  const form = useForm<FormValues>({ resolver: zodResolver(Schema), defaultValues: defaults });

  useEffect(() => {
    if (open) {
      form.reset(defaults);
      setConfirmDelete(false);
    }
  }, [open, defaults, form]);

  const isEdit = Boolean(task?.id);

  const onSubmit = form.handleSubmit(async (v) => {
    setBusy(true);
    try {
      const payload = {
        title: v.title.trim(),
        description: v.description?.trim() || null,
        status: v.status,
        priority: v.priority,
        energy: v.energy ? v.energy : null,
        plannedDate: v.plannedDate || null,
        dueDate: v.dueDate || null,
        estimatedMinutes: v.estimatedMinutes ? parseInt(v.estimatedMinutes, 10) : null,
        recurrence: v.recurrence,
        reminder: v.reminder,
        tagIds: task?.tagIds ?? [],
      };

      if (isEdit && task) {
        await update.mutateAsync({ id: task.id, ...payload });
        toast.success('Tarea actualizada.');
      } else {
        await create.mutateAsync(payload as never);
        toast.success('Listo, tarea creada.');
      }
      onClose();
    } catch (err) {
      console.error('[task-form] save failed:', err);
      toast.error(isEdit ? 'No se pudo actualizar.' : 'No se pudo crear.');
    } finally {
      setBusy(false);
    }
  });

  const onDelete = async () => {
    if (!task) return;
    setBusy(true);
    try {
      await remove.mutateAsync(task.id);
      toast.success('Tarea eliminada.');
      onClose();
    } catch {
      toast.error('No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar tarea' : 'Nueva tarea'}
      description={isEdit ? 'Modifica los detalles de la tarea.' : 'Añade la información que necesites, todo salvo el título es opcional.'}
      size="md"
      footer={
        <>
          {isEdit && (
            <button
              type="button"
              onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              disabled={busy}
              className={
                'mr-auto inline-flex items-center gap-1.5 text-xs h-8 px-2 rounded-md ' +
                (confirmDelete
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : 'text-red-400 hover:text-red-300')
              }
            >
              <Trash2 size={13} /> {confirmDelete ? 'Confirmar' : 'Eliminar'}
            </button>
          )}
          <button type="button" onClick={onClose} className="btn-outline h-8 text-xs px-3">
            Cancelar
          </button>
          <button type="submit" form="task-form" disabled={busy} className="btn-primary h-8 text-xs px-3">
            {busy ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
          </button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <input
            {...form.register('title')}
            autoFocus
            placeholder="¿Qué hay que hacer?"
            className="w-full bg-transparent outline-none text-lg font-medium placeholder:text-kibo-muted border-b border-transparent focus:border-kibo-accent pb-2"
          />
          {form.formState.errors.title && (
            <span className="block text-xs text-red-400 mt-1">
              {form.formState.errors.title.message}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <IconRow icon={Flag}>
            <select {...form.register('status')} className="input h-8 text-sm">
              {STATUSES.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </IconRow>

          <IconRow icon={Flag}>
            <select {...form.register('priority')} className="input h-8 text-sm">
              {PRIORITIES.map((p) => (
                <option key={p.v} value={p.v}>
                  {p.label}
                </option>
              ))}
            </select>
          </IconRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <IconRow icon={CalendarDays}>
            <div className="flex-1">
              <div className="text-[11px] text-kibo-muted mb-1">Planificada</div>
              <input type="date" {...form.register('plannedDate')} className="input h-8 text-sm" />
            </div>
          </IconRow>

          <IconRow icon={Clock}>
            <div className="flex-1">
              <div className="text-[11px] text-kibo-muted mb-1">Fecha límite</div>
              <input type="date" {...form.register('dueDate')} className="input h-8 text-sm" />
            </div>
          </IconRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <IconRow icon={Clock}>
            <div className="flex-1">
              <div className="text-[11px] text-kibo-muted mb-1">Duración estimada (min)</div>
              <input
                type="number"
                min={1}
                step={5}
                {...form.register('estimatedMinutes')}
                placeholder="30"
                className="input h-8 text-sm"
              />
            </div>
          </IconRow>

          <IconRow icon={Zap}>
            <div className="flex-1">
              <div className="text-[11px] text-kibo-muted mb-1">Energía</div>
              <select {...form.register('energy')} className="input h-8 text-sm">
                {ENERGIES.map((e) => (
                  <option key={e.v} value={e.v}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
          </IconRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <IconRow icon={Repeat}>
            <div className="flex-1">
              <div className="text-[11px] text-kibo-muted mb-1">Repetición</div>
              <select {...form.register('recurrence')} className="input h-8 text-sm">
                {RECURRENCES.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </IconRow>

          <IconRow icon={Bell}>
            <div className="flex-1">
              <div className="text-[11px] text-kibo-muted mb-1">Recordatorio</div>
              <select {...form.register('reminder')} className="input h-8 text-sm">
                {REMINDERS.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </IconRow>
        </div>

        <IconRow icon={AlignLeft} align="start">
          <MarkdownEditor
            value={form.watch('description') ?? ''}
            onChange={(v) => form.setValue('description', v, { shouldDirty: true })}
            placeholder="Notas o descripción en Markdown (opcional)"
            rows={4}
            textareaClassName="input min-h-[80px] text-sm w-full py-2 resize-y"
            className="w-full"
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
  icon: typeof Bell;
  children: React.ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className={'flex gap-3 ' + (align === 'start' ? 'items-start' : 'items-center')}>
      <Icon
        size={16}
        className={'text-kibo-muted shrink-0 ' + (align === 'start' ? 'mt-2' : '')}
      />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
