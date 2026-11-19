import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { useAuthStore } from './store/auth';
import './index.css';

async function waitForAuthHydration(): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

async function bootstrap() {
  await waitForAuthHydration();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
