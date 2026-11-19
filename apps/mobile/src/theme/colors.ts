// Kibo palette — single source of truth for JS-side styling (StyleSheet, icons, etc.).
// Mirrors tailwind.config.js so NativeWind classes and inline styles stay in sync.
export const colors = {
  bg: '#0a0a0b',
  surface: '#111114',
  border: '#1f1f24',
  muted: '#8a8a94',
  text: '#e8e8ee',
  accent: '#7c8cff',
  accentDeep: '#6366f1',
  violet: '#a78bfa',
} as const;

// Task priority is stored as low|medium|high (see @kibo/shared enums), but the
// UI labels them P1/P2/P3 like the desktop (high=P1, medium=P2, low=P3).
export const priorityColors: Record<string, string> = {
  high: '#f87171',
  medium: '#fbbf24',
  low: '#60a5fa',
};

export const priorityLabel: Record<string, string> = {
  high: 'P1',
  medium: 'P2',
  low: 'P3',
};

export const priorityRank: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
