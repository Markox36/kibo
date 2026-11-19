import { useMemo, useState, useCallback } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ScreenHeader, Card, SectionTitle, CenterState } from '../../ui/primitives';
import { Icon } from '../../ui/Icon';
import { colors, priorityColors, priorityLabel, priorityRank } from '../../theme/colors';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '../../hooks/useTasks';
import { TaskFormModal } from '../../components/TaskFormModal';
import type { TaskDto } from '../../lib/entities-api';

export default function TasksScreen() {
  const router = useRouter();
  const tasks = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [draft, setDraft] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);

  const onRefresh = useCallback(() => tasks.refetch(), [tasks]);

  const { pending, done } = useMemo(() => {
    const all = tasks.data ?? [];
    const rank = (p: string) => priorityRank[p] ?? 3;
    return {
      pending: all
        .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
        .sort((a, b) => rank(a.priority) - rank(b.priority)),
      done: all.filter((t) => t.status === 'done'),
    };
  }, [tasks.data]);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    createTask.mutate({ title, status: 'pending', priority: 'medium', tagIds: [] });
    setDraft('');
  };

  const openEdit = (t: TaskDto) => {
    setEditing(t);
    setFormOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Tareas"
        subtitle={pending.length ? `${pending.length} pendientes` : 'Sin pendientes'}
        right={
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push('/unscheduled')}
              hitSlop={6}
              className="h-9 w-9 items-center justify-center rounded-lg border border-kibo-border"
            >
              <Icon name="inbox" size={16} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openNew}
              hitSlop={6}
              className="h-9 w-9 items-center justify-center rounded-lg bg-kibo-accentDeep"
            >
              <Icon name="plus" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        }
      />

      <View className="px-4 pb-2">
        <Card className="flex-row items-center gap-2 px-3 py-1">
          <Icon name="plus" size={18} color={colors.muted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            placeholder="Añadir tarea rápida…"
            placeholderTextColor={colors.muted}
            className="h-10 flex-1 text-sm text-kibo-text"
          />
          {draft.trim() ? (
            <TouchableOpacity onPress={add} hitSlop={8}>
              <Text className="text-sm font-semibold text-kibo-accent">Añadir</Text>
            </TouchableOpacity>
          ) : null}
        </Card>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={tasks.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {tasks.isLoading ? (
          <CenterState loading title="Cargando tareas…" />
        ) : (tasks.data ?? []).length === 0 ? (
          <CenterState icon="check-square" title="Aún no tienes tareas" subtitle="Añade la primera arriba." />
        ) : (
          <>
            <View>
              <SectionTitle icon="circle">Pendientes</SectionTitle>
              {pending.length === 0 ? (
                <Card className="p-4">
                  <Text className="text-sm text-kibo-muted">¡Todo hecho! 🎉</Text>
                </Card>
              ) : (
                <View className="gap-2">
                  {pending.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() => updateTask.mutate({ id: t.id, status: 'done' })}
                      onDelete={() => deleteTask.mutate(t.id)}
                      onPress={() => openEdit(t)}
                      onFocus={() =>
                        router.push({ pathname: '/focus', params: { taskId: t.id } })
                      }
                    />
                  ))}
                </View>
              )}
            </View>

            {done.length > 0 ? (
              <View>
                <SectionTitle icon="check-circle">Completadas · {done.length}</SectionTitle>
                <View className="gap-2">
                  {done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={() => updateTask.mutate({ id: t.id, status: 'pending' })}
                      onDelete={() => deleteTask.mutate(t.id)}
                      onPress={() => openEdit(t)}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
    </Screen>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
  onPress,
  onFocus,
}: {
  task: TaskDto;
  onToggle: () => void;
  onDelete: () => void;
  onPress: () => void;
  onFocus?: () => void;
}) {
  const done = task.status === 'done';
  const color = priorityColors[task.priority] ?? colors.muted;
  return (
    <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
      <Card className="flex-row items-center gap-3 p-3">
        <TouchableOpacity onPress={onToggle} hitSlop={8}>
          <Icon name={done ? 'check-circle' : 'circle'} size={22} color={done ? colors.accent : color} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className={`text-sm ${done ? 'text-kibo-muted line-through' : 'text-kibo-text'}`}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {task.dueDate ? (
            <Text className="mt-0.5 text-xs text-kibo-muted">Vence {task.dueDate}</Text>
          ) : null}
        </View>
        {!done && priorityLabel[task.priority] ? (
          <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: `${color}22` }}>
            <Text className="text-[10px] font-semibold" style={{ color }}>
              {priorityLabel[task.priority]}
            </Text>
          </View>
        ) : null}
        {!done && onFocus ? (
          <TouchableOpacity onPress={onFocus} hitSlop={8}>
            <Icon name="play" size={16} color={colors.accent} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onDelete} hitSlop={8}>
          <Icon name="trash-2" size={16} color={colors.muted} />
        </TouchableOpacity>
      </Card>
    </TouchableOpacity>
  );
}
