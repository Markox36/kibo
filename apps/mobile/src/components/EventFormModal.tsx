// Event create/edit form, mirroring the web EventFormModal fields.
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Sheet, Field } from '../ui/Sheet';
import { DateInput, TimeInput, isoDate, isValidDate, isValidTime } from '../ui/DateField';
import { colors } from '../theme/colors';
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from '../hooks/useEvents';
import { useCalendars, useCreateCalendar } from '../hooks/useCalendars';
import type { EventDto } from '../lib/entities-api';

export interface EventFormInitial {
  id?: string;
  title?: string;
  calendarId?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  location?: string | null;
  description?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  initial: EventFormInitial | null;
}

function timePart(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function eventToInitial(e: EventDto): EventFormInitial {
  return {
    id: e.id,
    title: e.title,
    calendarId: e.calendarId,
    start: new Date(e.start),
    end: new Date(e.end),
    allDay: e.allDay,
    location: e.location,
    description: e.description,
  };
}

export function EventFormModal({ open, onClose, initial }: Props) {
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const remove = useDeleteEvent();
  const calendars = useCalendars();
  const createCalendar = useCreateCalendar();

  const [title, setTitle] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(initial?.id);
  const cals = calendars.data ?? [];

  useEffect(() => {
    if (!open) return;
    const start = initial?.start ?? new Date();
    const end = initial?.end ?? new Date(start.getTime() + 60 * 60 * 1000);
    setTitle(initial?.title ?? '');
    setCalendarId(
      initial?.calendarId ?? cals.find((c) => c.isDefault)?.id ?? cals[0]?.id ?? '',
    );
    setAllDay(initial?.allDay ?? false);
    setStartDate(isoDate(start));
    setStartTime(timePart(start));
    setEndDate(isoDate(end));
    setEndTime(timePart(end));
    setLocation(initial?.location ?? '');
    setDescription(initial?.description ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const save = async () => {
    if (busy) return;
    if (!title.trim()) {
      setError('El título es obligatorio.');
      return;
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setError('Fechas inválidas (AAAA-MM-DD).');
      return;
    }
    if (!allDay && (!isValidTime(startTime) || !isValidTime(endTime))) {
      setError('Horas inválidas (HH:MM).');
      return;
    }
    const start = new Date(allDay ? `${startDate}T00:00:00` : `${startDate}T${startTime}`);
    const end = new Date(allDay ? `${endDate}T23:59:59` : `${endDate}T${endTime}`);
    if (end.getTime() < start.getTime()) {
      setError('La fecha de fin debe ser posterior.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      let calId = calendarId;
      if (!calId) {
        const cal = await createCalendar.mutateAsync({
          name: 'Personal',
          color: colors.accent,
          isDefault: true,
        });
        calId = cal.id;
      }
      const payload = {
        title: title.trim(),
        calendarId: calId,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay,
        location: location.trim() || null,
        description: description.trim() || null,
      };
      if (isEdit && initial?.id) {
        await update.mutateAsync({ id: initial.id, ...payload });
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
    if (!initial?.id) return;
    Alert.alert('Eliminar evento', `¿Eliminar "${initial.title ?? 'este evento'}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutateAsync(initial.id!);
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
      title={isEdit ? 'Editar evento' : 'Nuevo evento'}
      description={isEdit ? 'Modifica los detalles del evento.' : 'Añade título, hora y calendario.'}
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
        placeholder="Añade un título"
        placeholderTextColor={colors.muted}
        className="mb-4 border-b border-kibo-border pb-2 text-lg font-medium text-kibo-text"
      />

      <Field label="Calendario">
        <View className="flex-row flex-wrap gap-2">
          {cals.length === 0 ? (
            <Text className="text-xs text-kibo-muted">Personal (se creará)</Text>
          ) : (
            cals.map((c) => {
              const active = c.id === calendarId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCalendarId(c.id)}
                  className={`h-8 flex-row items-center gap-1.5 rounded-full border px-3 ${
                    active ? 'border-kibo-accent/50 bg-kibo-accentDeep/20' : 'border-kibo-border'
                  }`}
                >
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <Text className={`text-xs ${active ? 'font-semibold text-kibo-accent' : 'text-kibo-muted'}`}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </Field>

      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm text-kibo-text">Todo el día</Text>
        <Switch
          value={allDay}
          onValueChange={setAllDay}
          trackColor={{ false: colors.border, true: colors.accentDeep }}
          thumbColor="#f4f4f7"
        />
      </View>

      <Field label="Inicio">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateInput value={startDate} onChange={setStartDate} allowClear={false} />
          </View>
          {!allDay ? (
            <View className="w-24">
              <TimeInput value={startTime} onChange={setStartTime} />
            </View>
          ) : null}
        </View>
      </Field>

      <Field label="Fin">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <DateInput value={endDate} onChange={setEndDate} allowClear={false} />
          </View>
          {!allDay ? (
            <View className="w-24">
              <TimeInput value={endTime} onChange={setEndTime} />
            </View>
          ) : null}
        </View>
      </Field>

      <Field label="Ubicación">
        <TextInput
          value={location}
          onChangeText={setLocation}
          placeholder="Ubicación (opcional)"
          placeholderTextColor={colors.muted}
          className="h-10 rounded-lg border border-kibo-border bg-kibo-bg px-3 text-sm text-kibo-text"
        />
      </Field>

      <Field label="Descripción">
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Descripción (opcional)"
          placeholderTextColor={colors.muted}
          multiline
          textAlignVertical="top"
          className="min-h-[70px] rounded-lg border border-kibo-border bg-kibo-bg px-3 py-2 text-sm text-kibo-text"
        />
      </Field>

      {error ? <Text className="mb-2 text-sm text-red-400">{error}</Text> : null}
    </Sheet>
  );
}
