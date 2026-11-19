import { useState } from 'react';
import { Plus, ArrowRight, Archive, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useInbox, useCreateInbox, useUpdateInbox, useDeleteInbox } from '../hooks/useInbox';
import { useCreateTask } from '../hooks/useTasks';

export function InboxPage() {
  const [text, setText] = useState('');
  const inbox = useInbox();
  const create = useCreateInbox();
  const update = useUpdateInbox();
  const remove = useDeleteInbox();
  const createTask = useCreateTask();

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    await create.mutateAsync({ text: t });
    setText('');
    toast.success('Capturado.');
  };

  const toTask = async (id: string, itemText: string) => {
    await createTask.mutateAsync({ title: itemText, status: 'pending', priority: 'medium', tagIds: [] });
    await update.mutateAsync({ id, status: 'processed' });
    toast.success('Convertido a tarea.');
  };

  const items = (inbox.data ?? []).filter((i) => i.status === 'pending');

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold mb-4">Inbox</h1>

      <div className="card p-3 mb-4 flex items-center gap-2">
        <Plus size={16} className="text-kibo-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Captura una idea, tarea o nota…"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-kibo-muted"
        />
        <button onClick={add} className="btn-primary h-7 text-xs px-2">
          Capturar
        </button>
      </div>

      <ul className="card divide-y divide-kibo-border">
        {items.map((i) => (
          <li key={i.id} className="p-3 flex items-center gap-3">
            <span className="flex-1 text-sm">{i.text}</span>
            <button
              onClick={() => toTask(i.id, i.text)}
              className="text-xs text-kibo-muted hover:text-kibo-accent inline-flex items-center gap-1"
              title="Convertir en tarea"
            >
              <ArrowRight size={14} /> Tarea
            </button>
            <button
              onClick={() => update.mutate({ id: i.id, status: 'archived' })}
              className="text-kibo-muted hover:text-kibo-text"
              title="Archivar"
            >
              <Archive size={14} />
            </button>
            <button
              onClick={() => remove.mutate(i.id)}
              className="text-kibo-muted hover:text-red-400"
              title="Eliminar"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="p-6 text-sm text-kibo-muted text-center">
            Inbox vacío. Captura lo primero que se te ocurra.
          </li>
        )}
      </ul>
    </div>
  );
}
