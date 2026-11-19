import { useMemo, useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { useNavigate } from '@tanstack/react-router';

interface Command {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
}

interface Props {
  onClose: () => void;
}

export function CommandPalette({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commands = useMemo<Command[]>(
    () => [
      { id: 'nav.dashboard', label: 'Ir a Hoy', hint: 'G D', action: () => (nav({ to: '/' }), onClose()) },
      { id: 'nav.calendar', label: 'Ir a Calendario', hint: 'G C', action: () => (nav({ to: '/calendar' }), onClose()) },
      { id: 'nav.tasks', label: 'Ir a Tareas', hint: 'G T', action: () => (nav({ to: '/tasks' }), onClose()) },
      { id: 'nav.inbox', label: 'Ir a Inbox', action: () => (nav({ to: '/inbox' }), onClose()) },
      { id: 'nav.settings', label: 'Ajustes', action: () => (nav({ to: '/settings' }), onClose()) },
      { id: 'create.task', label: 'Nueva tarea', hint: '⌘⇧T', action: () => (nav({ to: '/tasks' }), onClose()) },
      { id: 'create.event', label: 'Nuevo evento', hint: '⌘⇧E', action: () => (nav({ to: '/calendar' }), onClose()) },
    ],
    [nav, onClose],
  );

  const filtered = commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => setActive(0), [query]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[active]?.action();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-24 z-50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-kibo-border bg-kibo-surface shadow-soft overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Buscar comandos, tareas, eventos…"
          className="w-full bg-transparent px-4 h-12 outline-none border-b border-kibo-border placeholder:text-kibo-muted"
        />
        <ul className="max-h-80 overflow-auto py-1">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-kibo-muted">Sin resultados.</li>
          )}
          {filtered.map((c, i) => (
            <li
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => c.action()}
              className={clsx(
                'px-4 py-2 text-sm flex items-center gap-2 cursor-pointer',
                i === active ? 'bg-kibo-border/60' : 'hover:bg-kibo-border/30',
              )}
            >
              <span className="flex-1">{c.label}</span>
              {c.hint && <span className="kbd">{c.hint}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
