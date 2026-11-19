import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { useCalendars } from '../hooks/useCalendars';
import { eventsBulkApi, type BulkFilterInput, type BulkPreviewResult } from '../lib/entities-api';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BulkDeleteEventsModal({ open, onClose }: Props) {
  const calendars = useCalendars();
  const qc = useQueryClient();
  const [selectedCals, setSelectedCals] = useState<Set<string>>(new Set());
  const [titleRegex, setTitleRegex] = useState('');
  const [caseInsensitive, setCaseInsensitive] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [flag, setFlag] = useState<'any' | 'allday' | 'timed' | 'recurring' | 'imported'>('any');
  const [confirmText, setConfirmText] = useState('');
  const [preview, setPreview] = useState<BulkPreviewResult | null>(null);
  const [regexError, setRegexError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedCals(new Set());
      setTitleRegex('');
      setFrom('');
      setTo('');
      setFlag('any');
      setConfirmText('');
      setPreview(null);
      setRegexError(null);
    }
  }, [open]);

  const filter = useMemo<BulkFilterInput>(() => {
    const f: BulkFilterInput = {};
    if (selectedCals.size > 0) f.calendarIds = Array.from(selectedCals);
    if (titleRegex.trim()) {
      f.titleRegex = titleRegex.trim();
      f.titleCaseInsensitive = caseInsensitive;
    }
    if (from) f.from = new Date(`${from}T00:00:00`).toISOString();
    if (to) f.to = new Date(`${to}T23:59:59`).toISOString();
    if (flag === 'allday') f.allDayOnly = true;
    if (flag === 'timed') f.timedOnly = true;
    if (flag === 'recurring') f.recurringOnly = true;
    if (flag === 'imported') f.importedOnly = true;
    return f;
  }, [selectedCals, titleRegex, caseInsensitive, from, to, flag]);

  const hasAnyFilter = useMemo(
    () =>
      Boolean(
        (filter.calendarIds && filter.calendarIds.length > 0) ||
          filter.titleRegex ||
          filter.from ||
          filter.to ||
          filter.allDayOnly ||
          filter.timedOnly ||
          filter.recurringOnly ||
          filter.importedOnly,
      ),
    [filter],
  );

  useEffect(() => {
    if (!titleRegex.trim()) {
      setRegexError(null);
      return;
    }
    try {
      new RegExp(titleRegex);
      setRegexError(null);
    } catch (err) {
      setRegexError(err instanceof Error ? err.message : 'regex inválido');
    }
  }, [titleRegex]);

  const previewMut = useMutation({
    mutationFn: () => eventsBulkApi.preview(filter),
    onSuccess: (res) => setPreview(res),
    onError: (err) => {
      setPreview(null);
      toast.error(err instanceof Error ? err.message : 'Error');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => eventsBulkApi.delete(filter),
    onSuccess: (res) => {
      toast.success(`${res.deleted} eventos eliminados.`);
      qc.invalidateQueries({ queryKey: ['events'] });
      onClose();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    },
  });

  const toggleCal = (id: string) => {
    setSelectedCals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPreview(null);
  };

  const canDelete =
    hasAnyFilter &&
    !regexError &&
    preview !== null &&
    preview.count > 0 &&
    confirmText === String(preview.count);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Eliminar eventos en bloque"
      description="Filtra por calendario, título (regex), fecha o tipo. Vista previa obligatoria antes de borrar."
      size="lg"
      footer={
        <>
          <button className="btn-outline h-8 text-xs px-3" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-outline h-8 text-xs px-3"
            onClick={() => previewMut.mutate()}
            disabled={!hasAnyFilter || Boolean(regexError) || previewMut.isPending}
          >
            {previewMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Vista previa
          </button>
          <button
            className="btn-primary h-8 text-xs px-3 bg-red-500 hover:bg-red-400"
            onClick={() => deleteMut.mutate()}
            disabled={!canDelete || deleteMut.isPending}
          >
            {deleteMut.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Eliminar {preview?.count ?? ''}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <section>
          <span className="text-[11px] uppercase tracking-wide text-kibo-muted">Calendarios</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(calendars.data ?? []).map((c) => {
              const active = selectedCals.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleCal(c.id)}
                  className={
                    'inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border text-xs transition-colors ' +
                    (active
                      ? 'bg-kibo-accent/15 border-kibo-accent/60 text-kibo-text'
                      : 'border-kibo-border text-kibo-muted hover:text-kibo-text')
                  }
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: c.color, boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
                  />
                  {c.name}
                </button>
              );
            })}
            {(calendars.data ?? []).length === 0 && (
              <span className="text-[11px] text-kibo-muted italic">Sin calendarios.</span>
            )}
          </div>
          <p className="text-[11px] text-kibo-muted mt-1">
            Vacío = todos los calendarios.
          </p>
        </section>

        <section>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-kibo-muted">
              Título (regex)
            </span>
            <input
              className="input h-9 text-sm font-mono"
              value={titleRegex}
              onChange={(e) => {
                setTitleRegex(e.target.value);
                setPreview(null);
              }}
              placeholder="ej. ^Meeting|standup"
            />
          </label>
          <div className="mt-1 flex items-center gap-4 text-[11px] text-kibo-muted">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={caseInsensitive}
                onChange={(e) => {
                  setCaseInsensitive(e.target.checked);
                  setPreview(null);
                }}
                className="accent-kibo-accent"
              />
              Ignorar mayúsculas
            </label>
            {regexError && <span className="text-red-400">Regex inválido: {regexError}</span>}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-kibo-muted">Desde</span>
            <input
              type="date"
              className="input h-9 text-sm"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreview(null);
              }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-kibo-muted">Hasta</span>
            <input
              type="date"
              className="input h-9 text-sm"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPreview(null);
              }}
            />
          </label>
        </section>

        <section>
          <span className="text-[11px] uppercase tracking-wide text-kibo-muted">Tipo</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(
              [
                { id: 'any', label: 'Cualquiera' },
                { id: 'allday', label: 'Todo el día' },
                { id: 'timed', label: 'Con horario' },
                { id: 'recurring', label: 'Recurrentes' },
                { id: 'imported', label: 'Importados' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setFlag(opt.id);
                  setPreview(null);
                }}
                className={
                  'h-7 px-3 rounded-full text-xs border transition-colors ' +
                  (flag === opt.id
                    ? 'bg-kibo-accent/15 border-kibo-accent/60 text-kibo-text'
                    : 'border-kibo-border text-kibo-muted hover:text-kibo-text')
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {preview && (
          <section
            className={
              'rounded-lg border p-3 ' +
              (preview.count > 0
                ? 'border-red-500/40 bg-red-500/5'
                : 'border-kibo-border bg-kibo-bg/40')
            }
          >
            <div className="flex items-center gap-2 text-sm mb-2">
              {preview.count > 0 ? (
                <AlertTriangle size={14} className="text-red-400" />
              ) : (
                <span className="w-3.5 h-3.5" />
              )}
              <strong>{preview.count}</strong> evento{preview.count === 1 ? '' : 's'} coincide
              {preview.count === 1 ? '' : 'n'} con el filtro.
            </div>
            {preview.sample.length > 0 && (
              <ul className="text-[11px] text-kibo-muted space-y-0.5 max-h-40 overflow-y-auto font-mono">
                {preview.sample.map((e) => (
                  <li key={e.id} className="truncate">
                    {e.start.slice(0, 10)} · {e.title}
                  </li>
                ))}
                {preview.count > preview.sample.length && (
                  <li className="italic">… y {preview.count - preview.sample.length} más</li>
                )}
              </ul>
            )}
            {preview.count > 0 && (
              <label className="mt-3 flex flex-col gap-1">
                <span className="text-[11px] text-kibo-muted">
                  Escribí <span className="font-mono">{preview.count}</span> para confirmar:
                </span>
                <input
                  className="input h-8 text-sm font-mono"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={String(preview.count)}
                />
              </label>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
