import { useMemo, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Radio, Loader2, ExternalLink, Search, Link as LinkIcon } from 'lucide-react';
import clsx from 'clsx';
import { useLofi, currentStationLabel } from '../store/lofi';
import { STATIONS, CATEGORY_LABEL, type StationCategory, findStation } from '../lib/lofi-stations';

const CATEGORIES: StationCategory[] = [
  'lofi',
  'electronic',
  'ambient',
  'jazz',
  'rock',
  'eclectic',
  'classical',
];

export function LofiPlayer() {
  const lofi = useLofi();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<StationCategory | 'all'>('all');
  const [customUrl, setCustomUrl] = useState('');
  const [customName, setCustomName] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const currentId = lofi.stationId;
  const activeCustom = Boolean(lofi.customUrl);
  const currentStation = findStation(currentId);
  const label = currentStationLabel(lofi);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STATIONS.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.tag.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const grouped = useMemo(() => {
    const map = new Map<StationCategory, typeof STATIONS>();
    for (const s of filtered) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return map;
  }, [filtered]);

  const submitCustom = async () => {
    const u = customUrl.trim();
    if (!u) return;
    await lofi.playCustom(u, customName.trim() || undefined);
    setShowCustom(false);
    setCustomUrl('');
    setCustomName('');
  };

  return (
    <div className="rounded-xl border border-kibo-border bg-kibo-bg/40 p-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Radio size={14} className="text-kibo-accent" />
        <span className="text-xs uppercase tracking-wide text-kibo-muted font-medium">
          LoFi Radio
        </span>
        <a
          href="https://radio.garden"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[10px] text-kibo-muted hover:text-kibo-text inline-flex items-center gap-0.5"
          title="Explorar más en radio.garden"
        >
          radio.garden <ExternalLink size={9} />
        </a>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => lofi.toggle()}
          disabled={lofi.loading}
          className="w-10 h-10 rounded-full bg-kibo-accentDeep hover:bg-kibo-accent text-white flex items-center justify-center shrink-0 disabled:opacity-60"
          aria-label={lofi.playing ? 'Pausar' : 'Reproducir'}
        >
          {lofi.loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : lofi.playing ? (
            <Pause size={18} />
          ) : (
            <Play size={18} className="ml-0.5" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-[11px] text-kibo-muted truncate">
            {activeCustom
              ? 'URL personalizada'
              : currentStation
                ? `${currentStation.tag} · ${CATEGORY_LABEL[currentStation.category]}`
                : 'Elegí una emisora'}
          </div>
        </div>
        <button
          onClick={() => lofi.setVolume(lofi.volume > 0 ? 0 : 0.5)}
          className="text-kibo-muted hover:text-kibo-text"
          aria-label={lofi.volume > 0 ? 'Silenciar' : 'Activar sonido'}
        >
          {lofi.volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={lofi.volume}
        onChange={(e) => lofi.setVolume(Number(e.target.value))}
        className="w-full accent-kibo-accent"
        aria-label="Volumen"
      />

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-kibo-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar emisora…"
            className="input h-8 text-xs pl-7"
          />
        </div>
        <button
          onClick={() => setShowCustom((v) => !v)}
          className={
            'inline-flex items-center gap-1 h-8 px-2 rounded-md border text-[11px] transition-colors ' +
            (showCustom
              ? 'bg-kibo-accent/15 border-kibo-accent/50 text-kibo-text'
              : 'border-kibo-border text-kibo-muted hover:text-kibo-text')
          }
          title="Añadir URL propia"
        >
          <LinkIcon size={12} /> URL
        </button>
      </div>

      {showCustom && (
        <div className="flex flex-col gap-2 p-2 rounded-lg border border-kibo-border bg-kibo-surface/60">
          <input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://… (.mp3 / .aac stream)"
            className="input h-8 text-xs"
          />
          <input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Nombre (opcional)"
            className="input h-8 text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submitCustom}
              disabled={!customUrl.trim()}
              className="btn-primary h-7 text-xs px-3"
            >
              Reproducir
            </button>
            <p className="text-[10px] text-kibo-muted">
              Compatible con streams directos MP3/AAC (Icecast, Shoutcast).
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        <CatChip active={category === 'all'} onClick={() => setCategory('all')}>
          Todas
        </CatChip>
        {CATEGORIES.map((c) => (
          <CatChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {CATEGORY_LABEL[c]}
          </CatChip>
        ))}
      </div>

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1 -mr-1">
        {[...grouped.entries()].map(([cat, list]) => (
          <div key={cat} className="flex flex-col gap-1">
            <div className="text-[10px] uppercase tracking-wider text-kibo-muted mt-1">
              {CATEGORY_LABEL[cat]}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {list.map((s) => {
                const active = currentId === s.id && !activeCustom;
                return (
                  <button
                    key={s.id}
                    onClick={() => lofi.play(s.id)}
                    className={clsx(
                      'inline-flex items-center h-7 px-2.5 rounded-full text-[11px] border transition-colors',
                      active
                        ? 'bg-kibo-accent/20 border-kibo-accent/60 text-kibo-text'
                        : 'bg-transparent border-kibo-border text-kibo-muted hover:text-kibo-text',
                    )}
                    title={s.tag}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-[11px] text-kibo-muted italic text-center py-2">
            Sin resultados para «{query}».
          </p>
        )}
      </div>

      {lofi.error && (
        <div className="text-[11px] text-red-400">
          No se pudo iniciar el stream. Probá otra emisora.
        </div>
      )}
    </div>
  );
}

function CatChip({
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
        'inline-flex items-center h-6 px-2.5 rounded-full text-[10px] uppercase tracking-wide transition-colors',
        active
          ? 'bg-kibo-surface text-kibo-text border border-kibo-border'
          : 'text-kibo-muted hover:text-kibo-text border border-transparent',
      )}
    >
      {children}
    </button>
  );
}
