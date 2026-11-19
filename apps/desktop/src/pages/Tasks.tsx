import { useMemo, useState } from 'react';
import { Plus, Check, Circle, Trash2, Pencil, Calendar as CalIcon, Clock as ClockIcon, Flag } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '../hooks/useTasks';
import type { TaskDto } from '../lib/entities-api';
import { ConfirmModal } from '../components/ConfirmModal';
import { TaskFormModal } from '../components/TaskFormModal';

const STATUSES = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'pending', label: 'Pendiente' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'blocked', label: 'Bloqueada' },
  { id: 'done', label: 'Hecha' },
  { id: 'cancelled', label: 'Cancelada' },
] as const;

export function TasksPage() {
  const [view, setView] = useState<'list' | 'kanban'>('kanban');
  const [newTitle, setNewTitle] = useState('');
  const [toDelete, setToDelete] = useState<TaskDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TaskDto | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const tasks = useTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const handleDrop = async (targetStatus: string) => {
    const id = draggingId;
    setDraggingId(null);
    setDragOverStatus(null);
    if (!id) return;
    const task = (tasks.data ?? []).find((t) => t.id === id);
    if (!task || task.status === targetStatus) return;
    try {
      await update.mutateAsync({ id, status: targetStatus });
    } catch (err) {
      console.error('[tasks] status change failed:', err);
      toast.error('No se pudo mover la tarea.');
    }
  };

  const quickAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      await create.mutateAsync({ title, status: 'pending', priority: 'medium', tagIds: [] });
      setNewTitle('');
      toast.success('Listo, tarea creada.');
    } catch (err) {
      console.error('[tasks] create failed:', err);
      toast.error('No se pudo crear la tarea.');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (t: TaskDto) => {
    setEditing(t);
    setFormOpen(true);
  };

  const toggleDone = async (t: TaskDto) => {
    await update.mutateAsync({
      id: t.id,
      status: t.status === 'done' ? 'pending' : 'done',
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const s of STATUSES) map.set(s.id, []);
    for (const t of tasks.data ?? []) map.get(t.status)?.push(t) ?? map.set(t.status, [t]);
    return map;
  }, [tasks.data]);

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 flex-wrap">
        <h1 className="text-lg sm:text-xl font-semibold">Tareas</h1>
        <button onClick={openCreate} className="btn-primary h-8 text-xs px-3">
          <Plus size={14} /> <span className="hidden sm:inline">Nueva tarea</span><span className="sm:hidden">Nueva</span>
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-kibo-border bg-kibo-surface p-0.5">
          <TabBtn active={view === 'list'} onClick={() => setView('list')}>Lista</TabBtn>
          <TabBtn active={view === 'kanban'} onClick={() => setView('kanban')}>Kanban</TabBtn>
        </div>
      </div>

      <div className="card p-3 mb-4 flex items-center gap-2">
        <Plus size={16} className="text-kibo-muted" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
          placeholder="Captura rápida: título + Enter"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-kibo-muted"
        />
        <button
          onClick={openCreate}
          className="text-xs text-kibo-muted hover:text-kibo-text underline"
          title="Con más detalles"
        >
          más detalles…
        </button>
      </div>

      {tasks.isLoading && <p className="text-sm text-kibo-muted">Cargando…</p>}
      {tasks.isError && (
        <p className="text-sm text-red-400">No se pudo cargar. Comprueba tu conexión.</p>
      )}

      {view === 'list' && tasks.data && (
        <ul className="card divide-y divide-kibo-border">
          {tasks.data.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={() => toggleDone(t)}
              onEdit={() => openEdit(t)}
              onDelete={() => setToDelete(t)}
            />
          ))}
          {tasks.data.length === 0 && (
            <li className="p-6 text-sm text-kibo-muted text-center">Sin tareas todavía.</li>
          )}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(toDelete)}
        title={toDelete ? `Eliminar "${toDelete.title}"` : ''}
        description="La tarea desaparecerá de tus listas. Podrás restaurarla desde la papelera."
        confirmLabel="Eliminar"
        destructive
        onConfirm={async () => {
          if (!toDelete) return;
          await remove.mutateAsync(toDelete.id);
          toast.success('Tarea eliminada.');
        }}
        onClose={() => setToDelete(null)}
      />

      {view === 'kanban' && tasks.data && (
        <div className="flex xl:grid xl:grid-cols-6 gap-3 pb-4 overflow-x-auto -mx-1 px-1 snap-x">
          {STATUSES.map((s) => {
            const items = grouped.get(s.id) ?? [];
            const isOver = dragOverStatus === s.id;
            return (
              <section
                key={s.id}
                onDragOver={(e) => {
                  if (!draggingId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverStatus !== s.id) setDragOverStatus(s.id);
                }}
                onDragLeave={(e) => {
                  if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) {
                    setDragOverStatus((prev) => (prev === s.id ? null : prev));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(s.id);
                }}
                className={clsx(
                  'min-w-[240px] w-[80vw] max-w-[300px] xl:w-auto xl:max-w-none xl:min-w-0 shrink-0 xl:shrink rounded-xl border bg-kibo-surface/40 flex flex-col snap-start transition-colors',
                  isOver
                    ? 'border-kibo-accent bg-kibo-accent/5'
                    : 'border-kibo-border',
                )}
              >
                <header className="flex items-center gap-2 px-3 h-10 border-b border-kibo-border/70">
                  <span className={clsx('w-2 h-2 rounded-full', statusDot(s.id))} />
                  <h3 className="text-xs font-medium text-kibo-text flex-1">{s.label}</h3>
                  <span className="text-[11px] text-kibo-muted font-mono">{items.length}</span>
                </header>
                <div className="flex flex-col gap-2 p-2 min-h-[100px]">
                  {items.map((t, idx) => (
                    <KanbanCard
                      key={t.id}
                      task={t}
                      shortId={idx + 1}
                      dragging={draggingId === t.id}
                      onClick={() => openEdit(t)}
                      onDragStart={(e) => {
                        setDraggingId(t.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', t.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverStatus(null);
                      }}
                    />
                  ))}
                  {items.length === 0 && (
                    <div
                      className={clsx(
                        'text-[11px] text-center py-3 rounded-md border border-dashed',
                        isOver
                          ? 'text-kibo-accent border-kibo-accent/60'
                          : 'text-kibo-muted/70 border-transparent',
                      )}
                    >
                      {isOver ? 'Soltar aquí' : 'Sin tareas'}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskFormModal open={formOpen} onClose={() => setFormOpen(false)} task={editing} />
    </div>
  );
}

function fmtDdMmYy(iso: string): string {
  // input YYYY-MM-DD → dd-mm-yy
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${y!.slice(2)}`;
}

function KanbanCard({
  task,
  shortId,
  onClick,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: TaskDto;
  shortId: number;
  onClick: () => void;
  dragging: boolean;
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLButtonElement>) => void;
}) {
  const priorityColor =
    task.priority === 'high'
      ? 'text-red-400'
      : task.priority === 'medium'
        ? 'text-amber-400'
        : 'text-kibo-muted';
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={clsx(
        'text-left rounded-lg border border-kibo-border bg-kibo-bg/70 p-3 hover:border-kibo-muted/60 transition-all flex flex-col gap-2 cursor-grab active:cursor-grabbing',
        dragging && 'opacity-40',
      )}
      title="Arrastra para cambiar estado · click para editar"
    >
      <div className="flex items-center gap-2 text-[11px] text-kibo-muted">
        <Circle size={13} className="text-kibo-muted" />
        <span className="font-mono">#{shortId}</span>
      </div>
      <div
        className={clsx(
          'text-sm font-medium leading-snug',
          task.status === 'done' && 'line-through text-kibo-muted',
        )}
      >
        {task.title}
      </div>
      <div className="flex flex-col gap-1 text-[11px] text-kibo-muted font-mono">
        <div className="flex items-center gap-3">
          <span className={clsx('inline-flex items-center gap-1', priorityColor)}>
            <Flag size={11} />
            <span className="uppercase">
              {task.priority === 'high' ? 'P1' : task.priority === 'medium' ? 'P2' : 'P3'}
            </span>
          </span>
          {task.estimatedMinutes && <span>~{task.estimatedMinutes}m</span>}
        </div>
        {task.plannedDate && (
          <span className="inline-flex items-center gap-1">
            <CalIcon size={11} /> {fmtDdMmYy(task.plannedDate)}
          </span>
        )}
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 text-amber-400/80">
            <ClockIcon size={11} /> {fmtDdMmYy(task.dueDate)}
          </span>
        )}
      </div>
    </button>
  );
}

function statusDot(id: string): string {
  switch (id) {
    case 'inbox':
      return 'bg-neutral-500';
    case 'pending':
      return 'bg-kibo-accent';
    case 'in_progress':
      return 'bg-sky-400';
    case 'blocked':
      return 'bg-red-400';
    case 'done':
      return 'bg-emerald-500';
    case 'cancelled':
      return 'bg-neutral-600';
    default:
      return 'bg-neutral-500';
  }
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: TaskDto;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = task.status === 'done';
  return (
    <li className="flex items-center gap-3 p-3 hover:bg-kibo-border/30 group">
      <button
        onClick={onToggle}
        className="text-kibo-muted hover:text-kibo-accent shrink-0"
        title={done ? 'Marcar pendiente' : 'Marcar hecha'}
      >
        {done ? <Check size={16} /> : <Circle size={16} />}
      </button>
      <button
        onClick={onEdit}
        className="flex-1 text-left min-w-0"
        title="Editar tarea"
      >
        <div className={clsx('text-sm truncate', done && 'line-through text-kibo-muted')}>
          {task.title}
        </div>
        {(task.plannedDate || task.dueDate || task.estimatedMinutes) && (
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-kibo-muted font-mono">
            {task.plannedDate && (
              <span className="inline-flex items-center gap-1">
                <CalIcon size={11} /> {task.plannedDate}
              </span>
            )}
            {task.dueDate && (
              <span className="inline-flex items-center gap-1 text-amber-400/80">
                <ClockIcon size={11} /> {task.dueDate}
              </span>
            )}
            {task.estimatedMinutes && <span>{task.estimatedMinutes}′</span>}
          </div>
        )}
      </button>
      <span
        className={clsx(
          'text-[10px] uppercase tracking-wide font-mono shrink-0',
          task.priority === 'high'
            ? 'text-red-400'
            : task.priority === 'medium'
              ? 'text-amber-400'
              : 'text-kibo-muted',
        )}
      >
        {task.priority}
      </span>
      <button
        onClick={onEdit}
        className="text-kibo-muted hover:text-kibo-text opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        title="Editar"
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={onDelete}
        className="text-kibo-muted hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        title="Eliminar"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'px-3 h-7 rounded text-xs',
        active
          ? 'bg-kibo-border/70 text-kibo-text'
          : 'text-kibo-muted hover:text-kibo-text',
      )}
    >
      {children}
    </button>
  );
}
