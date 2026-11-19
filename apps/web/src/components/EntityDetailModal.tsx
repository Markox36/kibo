import { Pencil, Trash2, Clock, MapPin, AlignLeft, CalendarDays, Flag, Timer, Zap } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { Modal } from './Modal';
import { MarkdownView } from '@kibo/editor';
import type { EventDto, TaskDto } from '../lib/entities-api';

type DetailPayload =
  | { kind: 'event'; data: EventDto }
  | { kind: 'task-planned' | 'task-due'; data: TaskDto };

interface Props {
  open: boolean;
  payload: DetailPayload | null;
  calendarName?: string;
  calendarColor?: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}
function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
function fmtRange(start: string, end: string, allDay: boolean): string {
  if (allDay) return fmtDateLong(new Date(start));
  const s = new Date(start);
  const e = new Date(end);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  const day = fmtDateLong(s);
  const t = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return sameDay ? `${day} · ${t(s)} – ${t(e)}` : `${day} ${t(s)} → ${fmtDateLong(e)} ${t(e)}`;
}
function priorityLabel(p: string): string {
  return p === 'high' ? 'Alta (P1)' : p === 'medium' ? 'Media (P2)' : 'Baja (P3)';
}
function priorityColor(p: string): string {
  return p === 'high' ? 'text-red-400' : p === 'medium' ? 'text-amber-400' : 'text-kibo-muted';
}

export function EntityDetailModal({
  open,
  payload,
  calendarName,
  calendarColor,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const nav = useNavigate();

  if (!payload) return null;

  const isTask = payload.kind === 'task-planned' || payload.kind === 'task-due';
  const enterFocus = () => {
    if (!isTask) return;
    onClose();
    nav({ to: '/focus', search: { taskId: payload.data.id } });
  };

  const title =
    payload.kind === 'event' ? 'Evento' : payload.kind === 'task-planned' ? 'Tarea planificada' : 'Vencimiento';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="md"
      footer={
        <>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-red-400/30 text-red-300 hover:bg-red-400/10 text-xs"
            >
              <Trash2 size={13} /> Eliminar
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-md border border-kibo-border text-sm text-kibo-muted hover:text-kibo-text"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-kibo-border text-sm text-kibo-muted hover:text-kibo-text"
            title="Editar"
          >
            <Pencil size={13} /> Editar
          </button>
          {isTask && (
            <button
              type="button"
              onClick={enterFocus}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white text-sm"
              title="Entrar en Focus"
            >
              <Zap size={13} /> Focus
            </button>
          )}
        </>
      }
    >
      {payload.kind === 'event' ? (
        <EventBody data={payload.data} calendarName={calendarName} calendarColor={calendarColor} />
      ) : (
        <TaskBody data={payload.data} kind={payload.kind} />
      )}
    </Modal>
  );
}

function EventBody({
  data,
  calendarName,
  calendarColor,
}: {
  data: EventDto;
  calendarName?: string;
  calendarColor?: string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold leading-snug">{data.title}</h3>
      <Row icon={Clock}>{fmtRange(data.start, data.end, data.allDay)}</Row>
      {calendarName && (
        <Row icon={CalendarDays}>
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: calendarColor ?? '#7c8cff' }}
            />
            {calendarName}
          </span>
        </Row>
      )}
      {data.location && <Row icon={MapPin}>{data.location}</Row>}
      {data.description && (
        <Row icon={AlignLeft}>
          <MarkdownView source={data.description} className="text-sm" />
        </Row>
      )}
    </div>
  );
}

function TaskBody({ data, kind }: { data: TaskDto; kind: 'task-planned' | 'task-due' }) {
  const hasPlannedTime = Boolean(data.plannedStart);
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold leading-snug flex items-center gap-2">
        {data.title}
        {data.status === 'done' && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-kibo-accent/10 text-kibo-accent border border-kibo-accent/20">
            hecha
          </span>
        )}
      </h3>
      <Row icon={Flag}>
        <span className={priorityColor(data.priority)}>{priorityLabel(data.priority)}</span>
      </Row>
      {kind === 'task-planned' && data.plannedDate && (
        <Row icon={Clock}>
          {hasPlannedTime && data.plannedStart
            ? fmtRange(
                data.plannedStart,
                data.plannedEnd ?? data.plannedStart,
                false,
              )
            : `Planificada · ${fmtDateLong(new Date(data.plannedDate))}`}
        </Row>
      )}
      {data.dueDate && (
        <Row icon={CalendarDays}>Vence el {fmtDateLong(new Date(data.dueDate))}</Row>
      )}
      {data.estimatedMinutes && (
        <Row icon={Timer}>{data.estimatedMinutes} minutos estimados</Row>
      )}
      {data.description && (
        <Row icon={AlignLeft}>
          <MarkdownView source={data.description} className="text-sm" />
        </Row>
      )}
      {data.subtasks.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-widest text-kibo-muted mb-2">
            Subtareas ({data.subtasks.filter((s) => s.done).length}/{data.subtasks.length})
          </div>
          <ul className="space-y-1">
            {data.subtasks
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={
                      'w-3.5 h-3.5 rounded-sm border shrink-0 ' +
                      (s.done
                        ? 'bg-kibo-accent border-kibo-accent'
                        : 'border-kibo-border')
                    }
                  />
                  <span className={s.done ? 'line-through text-kibo-muted' : ''}>
                    {s.text}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon size={14} className="text-kibo-muted mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
