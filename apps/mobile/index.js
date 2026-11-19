// Custom entry: register the Android widget task handler before Expo Router
// boots, so the widget can render even when the app process starts headless.
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widget/task-handler';

registerWidgetTaskHandler(widgetTaskHandler);

import 'expo-router/entry';
