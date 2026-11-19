// Full task create/edit form, mirroring the web TaskFormModal fields.
import { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sheet, Field, Chips } from '../ui/Sheet';
import { DateInput, isValidDate } from '../ui/DateField';
import { colors } from '../theme/colors';
import { useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/useTasks';
import type { TaskDto } from '../lib/entities-api';

const STATUSES = [
  { v: 'pending', label: 'Pendiente' },
  { v: 'in_progress', label: 'En progreso' },
  { v: 'blocked', label: 'Bloqueada' },
  { v: 'done', label: 'Hecha' },
] as const;

const PRIORITIES = [
  { v: 'low', label: 'Baja' },
  { v: 'medium', label: 'Media' },
  { v: 'high', label: 'Alta' },
] as const;

const ENERGIES = [
  { v: '', label: '—' },
  { v: 'low', label: 'Baja' },
  { v: 'medium', label: 'Media' },
  { v: 'high', label: 'Alta' },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  task: TaskDto | null;
  /** Pre-fill plannedDate when creating from a calendar day. */
  initialPlannedDate?: string;
}

export function TaskFormModal({ open, onClose, task, initialPlannedDate }: Props) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<string>('pending');
  const [priority, setPriority] = useState<string>('medium');
  const [energy, setEnergy] = useState<string>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimated, setEstimated] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(task?.id);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? '');
    setStatus(task?.status && task.status !== 'inbox' ? task.status : 'pending');
    setPriority(task?.priority ?? 'medium');
    setEnergy(task?.energy ?? '');
    setPlannedDate(task?.plannedDate?.slice(0, 10) ?? initialPlannedDate ?? '');
    setDueDate(task?.dueDate?.slice(0, 10) ?? '');
    setEstimated(task?.estimatedMinutes ? String(task.estimatedMinutes) : '');
    setDescription(task?.description ?? '');
    setError(null);
  }, [open, task, initialPlannedDate]);

  const save = async () => {
    if (busy) return;
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (plannedDate && !isValidDate(plannedDate)) {
      setError('Fecha planificada inválida (AAAA-MM-DD).');
      return;
    }
    if (dueDate && !isValidDate(dueDate)) {
      setError('Fecha límite inválida (AAAA-MM-DD).');
      return;
    }
    setError(null);
    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      energy: energy || null,
      plannedDate: plannedDate || null,
      dueDate: dueDate || null,
      estimatedMinutes: estimated ? parseInt(estimated, 10) : null,
      tagIds: task?.tagIds ?? [],
    };
    try {
      if (isEdit && task) {
        await update.mutateAsync({ id: task.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch {
      setError(isEdit ? 'No se pudo actualizar.' : 'No se pudo crear.');
    } finally {
      setBusy(false);
    }
  };

  const del = () => {
    if (!task) return;
    Alert.alert('Eliminar tarea', `¿Eliminar "${task.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(task.id);
            onClose();
          } catch {
            setError('No se pudo eliminar.');
          }
        },
      },
    ]);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar tarea' : 'Nueva tarea'}
      description={isEdit ? 'Modifica los detalles de la tarea.' : 'Todo salvo el título es opcional.'}
      footer={
        <View className="flex-row items-center gap-2">
          {isEdit ? (
            <TouchableOpacity onPress={del} disabled={busy} className="mr-auto p-2" hitSlop={6}>
              <Text className="text-sm font-medium text-red-400">Eliminar</Text>
            </TouchableOpacity>
          ) : (
            <View className="mr-auto" />
          )}
          <TouchableOpacity
            onPress={onClose}
            disabled={busy}
            className="h-10 items-center justify-center rounded-lg border border-kibo-border px-4"
          >
            <Text className="text-sm text-kibo-text">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={save}
            disabled={busy}
            className={`h-10 items-center justify-center rounded-lg bg-kibo-accentDeep px-4 ${busy ? 'opacity-60' : ''}`}
          >
            <Text className="text-sm font-semibold text-white">
              {busy ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="¿Qué hay que hacer?"
        placeholderTextColor={colors.muted}
        className="mb-4 border-b border-kibo-border pb-2 text-lg font-medium text-kibo-text"
      />

      <Field label="Estado">
        <Chips options={[...STATUSES]} value={status as never} onChange={setStatus} />
      </Field>

      <Field label="Prioridad">
        <Chips options={[...PRIORITIES]} value={priority as never} onChange={setPriority} />
      </Field>

      <Field label="Planificada">
        <DateInput value={plannedDate} onChange={setPlannedDate} />
      </Field>

      <Field label="Fecha límite">
        <DateInput value={dueDate} onChange={setDueDate} />
      </Field>

      <Field label="Duración estimada (min)">
        <TextInput
          value={estimated}
          onChangeText={(v) => setEstimated(v.replace(/[^0-9]/g, ''))}
          placeholder="30"
          placeholderTextColor={colors.muted}
          keyboardType="number-pad"
          className="h-10 rounded-lg border border-kibo-border bg-kibo-bg px-3 text-sm text-kibo-text"
        />
      </Field>

      <Field label="Energía">
        <Chips options={[...ENERGIES]} value={energy as never} onChange={setEnergy} />
      </Field>

      <Field label="Notas (Markdown)">
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Notas o descripción (opcional)"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          className="min-h-[80px] rounded-lg border border-kibo-border bg-kibo-bg px-3 py-2 text-sm text-kibo-text"
        />
      </Field>

      {error ? <Text className="mb-2 text-sm text-red-400">{error}</Text> : null}
    </Sheet>
  );
}
