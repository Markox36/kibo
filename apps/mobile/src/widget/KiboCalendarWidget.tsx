import { createElement as h } from 'react';
import { FlexWidget, TextWidget, type ColorProp } from 'react-native-android-widget';
import type { WidgetSnapshot } from './data';

// IMPORTANT: this widget is built with React.createElement (NOT JSX) on purpose.
// The app's Babel config sets NativeWind's jsxImportSource for all JSX, and
// NativeWind's runtime calls React hooks — which throws "Invalid Hook Call"
// when react-native-android-widget renders the tree with its own reconciler.
// Using createElement bypasses the NativeWind JSX runtime entirely.

const BG = '#111114';
const BORDER = '#1f1f24';
const TEXT = '#e8e8ee';
const MUTED = '#8a8a94';
const ACCENT = '#7c8cff';
const MAX_ROWS = 4;

const asColor = (c: string): ColorProp => c as ColorProp;

function eventRow(e: { title: string; time: string; color: string }, i: number) {
  return h(
    FlexWidget,
    {
      key: `${e.title}-${i}`,
      style: { flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 8 },
    },
    h(FlexWidget, {
      style: {
        width: 3,
        height: 30,
        borderRadius: 2,
        backgroundColor: asColor(e.color || ACCENT),
        marginRight: 10,
      },
    }),
    h(
      FlexWidget,
      { style: { flexDirection: 'column', flex: 1 } },
      h(TextWidget, { text: e.title, maxLines: 1, style: { fontSize: 13, fontWeight: '500', color: TEXT } }),
      h(TextWidget, { text: e.time, style: { fontSize: 11, color: MUTED } }),
    ),
  );
}

export function KiboCalendarWidget({ snapshot }: { snapshot: WidgetSnapshot }) {
  const shown = snapshot.events.slice(0, MAX_ROWS);
  const extra = snapshot.events.length - shown.length;

  const header = h(
    FlexWidget,
    { style: { flexDirection: 'row', alignItems: 'center', width: 'match_parent' } },
    h(TextWidget, { text: 'Hoy', style: { fontSize: 16, fontWeight: 'bold', color: TEXT } }),
    h(FlexWidget, { style: { flex: 1 } }),
    h(TextWidget, { text: snapshot.dateLabel, style: { fontSize: 11, color: MUTED } }),
  );

  const divider = h(FlexWidget, {
    style: { height: 1, width: 'match_parent', backgroundColor: BORDER, marginTop: 8, marginBottom: 8 },
  });

  const body =
    shown.length === 0
      ? [
          h(
            FlexWidget,
            {
              key: 'empty',
              style: { flex: 1, width: 'match_parent', justifyContent: 'center', alignItems: 'center' },
            },
            h(TextWidget, { text: 'Sin eventos hoy', style: { fontSize: 13, color: MUTED } }),
          ),
        ]
      : shown.map((e, i) => eventRow(e, i));

  const footer =
    extra > 0
      ? h(TextWidget, { key: 'more', text: `+${extra} más`, style: { fontSize: 11, color: ACCENT, marginTop: 2 } })
      : null;

  return h(
    FlexWidget,
    {
      clickAction: 'OPEN_APP',
      style: {
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 14,
      },
    },
    header,
    divider,
    ...body,
    footer,
  );
}
