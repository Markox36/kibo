import { useEffect } from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { usePrefs } from '../store/prefs';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useZoom(): void {
  const zoom = usePrefs((s) => s.zoom);
  const zoomIn = usePrefs((s) => s.zoomIn);
  const zoomOut = usePrefs((s) => s.zoomOut);
  const zoomReset = usePrefs((s) => s.zoomReset);

  useEffect(() => {
    if (isTauri) {
      getCurrentWebview()
        .setZoom(zoom)
        .catch(() => {
          (document.documentElement.style as CSSStyleDeclaration & { zoom?: string }).zoom =
            String(zoom);
        });
    } else {
      (document.documentElement.style as CSSStyleDeclaration & { zoom?: string }).zoom =
        String(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
        if (e.key !== '0' && e.key !== '+' && e.key !== '-' && e.key !== '=') return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        zoomReset();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else if (e.deltaY > 0) zoomOut();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onWheel);
    };
  }, [zoomIn, zoomOut, zoomReset]);
}
