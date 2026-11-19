import {
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';
import { RootLayout } from './layouts/RootLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { CalendarPage } from './pages/Calendar';
import { TasksPage } from './pages/Tasks';
import { InboxPage } from './pages/Inbox';
import { UnscheduledPage } from './pages/Unscheduled';
import { FocusPage } from './pages/Focus';
import { SettingsPage } from './pages/Settings';
import { AdminPage } from './pages/Admin';
import { useAuthStore } from './store/auth';
import { tryRefresh } from './lib/api';

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth-layout',
  component: AuthLayout,
});
const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/login',
  component: LoginPage,
});
const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/register',
  component: RegisterPage,
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app-layout',
  component: RootLayout,
  beforeLoad: async () => {
    const { accessToken, refreshToken } = useAuthStore.getState();
    if (accessToken) return;
    if (refreshToken) {
      await tryRefresh();
      // if refresh survived (transient network err vs invalid), let app in;
      // API calls will retry refresh on 401
      if (useAuthStore.getState().refreshToken) return;
    }
    throw redirect({ to: '/login' });
  },
});
const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/',
  component: Dashboard,
});
const calendarRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/calendar',
  component: CalendarPage,
});
const tasksRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/tasks',
  component: TasksPage,
});
const inboxRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/inbox',
  component: InboxPage,
});
const unscheduledRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/unscheduled',
  component: UnscheduledPage,
});
const focusRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/focus',
  component: FocusPage,
  validateSearch: (search: Record<string, unknown>) => ({
    taskId: typeof search.taskId === 'string' ? search.taskId : undefined,
  }),
});
const settingsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/settings',
  component: SettingsPage,
});
const adminRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: '/admin',
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([
  authLayoutRoute.addChildren([loginRoute, registerRoute]),
  appLayoutRoute.addChildren([
    dashboardRoute,
    calendarRoute,
    tasksRoute,
    inboxRoute,
    unscheduledRoute,
    focusRoute,
    settingsRoute,
    adminRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
