import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { findStation, STATIONS } from '../lib/lofi-stations';

let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  if (typeof window === 'undefined') throw new Error('audio_ssr');
  audioEl = new Audio();
  audioEl.preload = 'none';
  audioEl.crossOrigin = 'anonymous';
  audioEl.addEventListener('playing', () => {
    useLofi.setState({ playing: true, loading: false, error: null });
  });
  audioEl.addEventListener('pause', () => {
    useLofi.setState({ playing: false });
  });
  audioEl.addEventListener('waiting', () => {
    useLofi.setState({ loading: true });
  });
  audioEl.addEventListener('error', () => {
    useLofi.setState({ playing: false, loading: false, error: 'stream_error' });
  });
  audioEl.addEventListener('ended', () => {
    useLofi.setState({ playing: false });
  });
  return audioEl;
}

interface LofiState {
  playing: boolean;
  loading: boolean;
  stationId: string | null;
  customUrl: string | null;
  customName: string | null;
  volume: number;
  error: string | null;

  play: (id: string) => Promise<void>;
  playCustom: (url: string, name?: string) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  toggle: () => Promise<void>;
  setVolume: (v: number) => void;
}

export const useLofi = create<LofiState>()(
  persist(
    (set, get) => ({
      playing: false,
      loading: false,
      stationId: STATIONS[0]?.id ?? null,
      customUrl: null,
      customName: null,
      volume: 0.5,
      error: null,

      play: async (id) => {
        const station = findStation(id);
        if (!station) return;
        const el = getAudio();
        set({ stationId: id, customUrl: null, customName: null, loading: true, error: null });
        try {
          el.src = station.url;
          el.volume = get().volume;
          await el.play();
        } catch {
          set({ playing: false, loading: false, error: 'play_failed' });
        }
      },

      playCustom: async (url, name) => {
        const el = getAudio();
        set({
          stationId: null,
          customUrl: url,
          customName: name ?? url,
          loading: true,
          error: null,
        });
        try {
          el.src = url;
          el.volume = get().volume;
          await el.play();
        } catch {
          set({ playing: false, loading: false, error: 'play_failed' });
        }
      },

      pause: () => {
        const el = getAudio();
        el.pause();
        set({ playing: false, loading: false });
      },

      resume: async () => {
        const el = getAudio();
        const { stationId, customUrl } = get();
        if (!el.src) {
          if (customUrl) {
            await get().playCustom(customUrl, get().customName ?? undefined);
            return;
          }
          if (stationId) {
            await get().play(stationId);
            return;
          }
          return;
        }
        try {
          el.volume = get().volume;
          await el.play();
        } catch {
          set({ playing: false, error: 'play_failed' });
        }
      },

      toggle: async () => {
        const { playing } = get();
        if (playing) get().pause();
        else await get().resume();
      },

      setVolume: (v) => {
        const vol = Math.max(0, Math.min(1, v));
        set({ volume: vol });
        if (audioEl) audioEl.volume = vol;
      },
    }),
    {
      name: 'kibo-lofi',
      partialize: (s) => ({
        stationId: s.stationId,
        customUrl: s.customUrl,
        customName: s.customName,
        volume: s.volume,
      }),
    },
  ),
);

export function currentStationLabel(state: {
  stationId: string | null;
  customUrl: string | null;
  customName: string | null;
}): string {
  if (state.customUrl) return state.customName ?? 'Custom stream';
  const s = findStation(state.stationId);
  return s?.name ?? '—';
}
