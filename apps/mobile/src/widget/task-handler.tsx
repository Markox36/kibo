import { createElement as h } from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { KiboCalendarWidget } from './KiboCalendarWidget';
import { readWidgetSnapshot } from './data';

// Runs in a headless JS context whenever Android asks the widget to render
// (added, periodic update, resized, clicked). Reads the snapshot the app
// persisted and draws it. Uses createElement (not JSX) to avoid NativeWind's
// JSX runtime — see KiboCalendarWidget.tsx.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetInfo.widgetName !== 'KiboCalendar') return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK': {
      const snapshot = await readWidgetSnapshot();
      props.renderWidget(h(KiboCalendarWidget, { snapshot }));
      break;
    }
    case 'WIDGET_DELETED':
    default:
      break;
  }
}
