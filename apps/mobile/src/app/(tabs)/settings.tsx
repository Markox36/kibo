import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, ScreenHeader, Card, SectionTitle } from '../../ui/primitives';
import { Icon } from '../../ui/Icon';
import { colors } from '../../theme/colors';
import { useAuthStore } from '../../store/auth';
import { usePrefs } from '../../store/prefs';
import { authApi } from '../../lib/auth-api';
import { ApiError } from '../../lib/api';
import { integrationsApi } from '../../lib/entities-api';
import { useCalendars, useCreateCalendar } from '../../hooks/useCalendars';
import { queryClient } from '../../lib/query';
import { ensureNotificationSetup, sendTestNotification } from '../../lib/notifications';
import { TimeInput, isValidTime } from '../../ui/DateField';

const CAL_COLORS = ['#7c8cff', '#a78bfa', '#22c55e', '#f97316', '#ef4444', '#eab308'];

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const prefs = usePrefs();

  const toggleReminders = async (value: boolean) => {
    if (!value) {
      prefs.set({ notificationsEnabled: false });
      return;
    }
    const granted = await ensureNotificationSetup();
    if (granted) {
      prefs.set({ notificationsEnabled: true });
    } else {
      Alert.alert(
        'Permiso necesario',
        'Activa las notificaciones de Kibo en los ajustes del sistema para recibir recordatorios.',
      );
    }
  };

  const testNotification = async () => {
    const ok = await sendTestNotification();
    if (!ok) {
      Alert.alert('Sin permiso', 'Activa los recordatorios primero.');
    }
  };

  const logout = async () => {
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Even if the server call fails, we still drop the local session.
    }
    queryClient.clear();
    clear();
  };

  const lead = prefs.reminderLeadMinutes;

  return (
    <Screen>
      <ScreenHeader title="Ajustes" subtitle="Cuenta, calendarios y preferencias" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 22 }}>
        <View>
          <SectionTitle icon="user">Cuenta</SectionTitle>
          <Card className="p-4">
            <Text className="text-base font-semibold text-kibo-text">
              {user?.name || 'Sin nombre'}
            </Text>
            <Text className="mt-0.5 text-sm text-kibo-muted">{user?.email}</Text>
          </Card>
        </View>

        <CalendarsSection />
        <GoogleIntegrationSection />

        <View>
          <SectionTitle icon="bell">Notificaciones</SectionTitle>
          <Card>
            <Row
              label="Recordatorios"
              hint="Avisos de eventos y tareas"
              value={prefs.notificationsEnabled}
              onChange={toggleReminders}
            />
            <Divider />
            <Stepper
              label="Antelación"
              value={lead}
              suffix="min"
              disabled={!prefs.notificationsEnabled}
              onDec={() => prefs.set({ reminderLeadMinutes: Math.max(0, lead - 5) })}
              onInc={() => prefs.set({ reminderLeadMinutes: lead + 5 })}
            />
            <Divider />
            <Row
              label="Eventos"
              value={prefs.notifyEvents}
              disabled={!prefs.notificationsEnabled}
              onChange={(v) => prefs.set({ notifyEvents: v })}
            />
            <Divider />
            <Row
              label="Tareas con vencimiento"
              value={prefs.notifyTaskDue}
              disabled={!prefs.notificationsEnabled}
              onChange={(v) => prefs.set({ notifyTaskDue: v })}
            />
            {prefs.notificationsEnabled ? (
              <>
                <Divider />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={testNotification}
                  className="flex-row items-center gap-2 p-4"
                >
                  <Icon name="bell" size={16} color={colors.accent} />
                  <Text className="text-sm font-medium text-kibo-accent">Probar notificación</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </Card>
        </View>

        <WorkingHoursSection />
        <FocusSection />

        <TouchableOpacity activeOpacity={0.7} onPress={logout}>
          <Card className="flex-row items-center justify-center gap-2 p-4">
            <Icon name="log-out" size={18} color="#f87171" />
            <Text className="text-sm font-semibold" style={{ color: '#f87171' }}>
              Cerrar sesión
            </Text>
          </Card>
        </TouchableOpacity>

        <Text className="text-center text-xs text-kibo-muted">Kibo · versión 0.1.0</Text>
      </ScrollView>
    </Screen>
  );
}

function CalendarsSection() {
  const calendars = useCalendars();
  const create = useCreateCalendar();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(CAL_COLORS[0]!);

  const add = async () => {
    if (!newName.trim() || create.isPending) return;
    try {
      await create.mutateAsync({ name: newName.trim(), color: newColor });
      setNewName('');
    } catch {
      Alert.alert('Error', 'No se pudo crear el calendario.');
    }
  };

  return (
    <View>
      <SectionTitle icon="calendar">Calendarios</SectionTitle>
      <Card className="p-4">
        <View className="mb-3 gap-2">
          {(calendars.data ?? []).map((c) => (
            <View key={c.id} className="flex-row items-center gap-2">
              <View className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              <Text className="flex-1 text-sm text-kibo-text">{c.name}</Text>
              {c.isDefault ? (
                <Text className="text-[10px] uppercase tracking-wide text-kibo-muted">Default</Text>
              ) : null}
            </View>
          ))}
          {(calendars.data ?? []).length === 0 ? (
            <Text className="text-xs text-kibo-muted">Aún no hay calendarios.</Text>
          ) : null}
        </View>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Nombre del calendario"
          placeholderTextColor={colors.muted}
          className="mb-2 h-10 rounded-lg border border-kibo-border bg-kibo-bg px-3 text-sm text-kibo-text"
        />
        <View className="flex-row items-center gap-2">
          <View className="flex-1 flex-row items-center gap-2">
            {CAL_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setNewColor(c)}
                className="h-6 w-6 rounded-full"
                style={{
                  backgroundColor: c,
                  borderWidth: newColor === c ? 2 : 0,
                  borderColor: '#fff',
                }}
              />
            ))}
          </View>
          <TouchableOpacity
            onPress={add}
            disabled={!newName.trim() || create.isPending}
            className={`h-9 items-center justify-center rounded-lg bg-kibo-accentDeep px-3 ${
              !newName.trim() || create.isPending ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-xs font-semibold text-white">Añadir</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );
}

function GoogleIntegrationSection() {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['google-integration'],
    queryFn: integrationsApi.googleStatus,
  });
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const { authUrl } = await integrationsApi.googleStart({});
      await WebBrowser.openBrowserAsync(authUrl);
      // The OAuth flow finishes in the browser against the API callback;
      // refetch when the user comes back.
      qc.invalidateQueries({ queryKey: ['google-integration'] });
    } catch {
      Alert.alert('Error', 'No se pudo iniciar la conexión con Google.');
    } finally {
      setBusy(false);
    }
  };

  const sync = useMutation({
    mutationFn: () => integrationsApi.googleSync(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      Alert.alert(
        'Sincronizado',
        `${r.eventsInserted} nuevos · ${r.eventsUpdated} actualizados · ${r.eventsDeleted} eliminados`,
      );
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'reauth_required') {
        // Refetch status so the UI switches to the "volver a conectar" state.
        qc.invalidateQueries({ queryKey: ['google-integration'] });
        Alert.alert(
          'Conexión caducada',
          'La conexión con Google caducó. Vuelve a conectar tu cuenta para seguir sincronizando.',
        );
        return;
      }
      Alert.alert('Error', 'No se pudo sincronizar.');
    },
  });

  const disconnect = () => {
    Alert.alert('Desconectar Google', '¿Desconectar Google Calendar?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desconectar',
        style: 'destructive',
        onPress: async () => {
          try {
            await integrationsApi.googleDisconnect();
            qc.invalidateQueries({ queryKey: ['google-integration'] });
          } catch {
            Alert.alert('Error', 'No se pudo desconectar.');
          }
        },
      },
    ]);
  };

  const s = status.data;
  if (!s || !s.configured) return null;

  return (
    <View>
      <SectionTitle icon="link">Integraciones</SectionTitle>
      <Card className="p-4">
        <View className="flex-row items-center gap-2">
          <Icon name="calendar" size={16} color={colors.accent} />
          <Text className="flex-1 text-sm font-medium text-kibo-text">Google Calendar</Text>
          {s.connected ? (
            s.needsReauth ? (
              <Text className="text-xs text-amber-400">Caducado</Text>
            ) : (
              <Text className="text-xs text-emerald-400">Conectado</Text>
            )
          ) : (
            <Text className="text-xs text-kibo-muted">No conectado</Text>
          )}
        </View>
        {s.connected && s.email ? (
          <Text className="mt-1 text-xs text-kibo-muted">{s.email}</Text>
        ) : null}
        {s.connected && s.needsReauth ? (
          <Text className="mt-2 text-xs text-amber-400">
            La conexión con Google caducó. Vuelve a conectar tu cuenta para seguir sincronizando.
          </Text>
        ) : null}
        <View className="mt-3 flex-row gap-2">
          {s.connected ? (
            <>
              {s.needsReauth ? (
                <TouchableOpacity
                  onPress={connect}
                  disabled={busy}
                  className={`h-9 items-center justify-center rounded-lg bg-kibo-accentDeep px-3 ${busy ? 'opacity-50' : ''}`}
                >
                  <Text className="text-xs font-semibold text-white">
                    {busy ? 'Abriendo…' : 'Volver a conectar'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => sync.mutate()}
                  disabled={sync.isPending}
                  className={`h-9 flex-row items-center gap-1.5 rounded-lg border border-kibo-border px-3 ${
                    sync.isPending ? 'opacity-50' : ''
                  }`}
                >
                  <Icon name="refresh-cw" size={13} color={colors.text} />
                  <Text className="text-xs text-kibo-text">
                    {sync.isPending ? 'Sincronizando…' : 'Sincronizar'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={disconnect}
                className="h-9 items-center justify-center rounded-lg border border-red-500/40 px-3"
              >
                <Text className="text-xs text-red-400">Desconectar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              onPress={connect}
              disabled={busy}
              className={`h-9 items-center justify-center rounded-lg bg-kibo-accentDeep px-3 ${busy ? 'opacity-50' : ''}`}
            >
              <Text className="text-xs font-semibold text-white">
                {busy ? 'Abriendo…' : 'Conectar con Google'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </View>
  );
}

function WorkingHoursSection() {
  const wh = usePrefs((s) => s.workingHours);
  const setWorkingHours = usePrefs((s) => s.setWorkingHours);
  const [start, setStart] = useState(wh.start);
  const [end, setEnd] = useState(wh.end);

  const commit = (field: 'start' | 'end', value: string) => {
    if (isValidTime(value)) setWorkingHours({ [field]: value });
  };

  return (
    <View>
      <SectionTitle icon="clock">Horario laboral</SectionTitle>
      <Card className="p-4">
        <Text className="mb-3 text-xs text-kibo-muted">
          Kibo usa este horario para calcular la carga diaria y detectar días sobrecargados.
        </Text>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1 text-[11px] uppercase tracking-wide text-kibo-muted">Inicio</Text>
            <TimeInput
              value={start}
              onChange={(v) => {
                setStart(v);
                commit('start', v);
              }}
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-[11px] uppercase tracking-wide text-kibo-muted">Fin</Text>
            <TimeInput
              value={end}
              onChange={(v) => {
                setEnd(v);
                commit('end', v);
              }}
            />
          </View>
        </View>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="flex-1 text-sm text-kibo-text">Contar fines de semana</Text>
          <Switch
            value={wh.workOnWeekends}
            onValueChange={(v) => setWorkingHours({ workOnWeekends: v })}
            trackColor={{ false: colors.border, true: colors.accentDeep }}
            thumbColor="#f4f4f7"
          />
        </View>
      </Card>
    </View>
  );
}

function FocusSection() {
  const pomodoro = usePrefs((s) => s.pomodoro);
  const customTimer = usePrefs((s) => s.customTimer);
  const setPomodoro = usePrefs((s) => s.setPomodoro);
  const setCustomTimer = usePrefs((s) => s.setCustomTimer);
  return (
    <View>
      <SectionTitle icon="zap">Concentración</SectionTitle>
      <Card>
        <Stepper
          label="Pomodoro trabajo"
          value={pomodoro.workMin}
          suffix="min"
          onDec={() => setPomodoro({ workMin: Math.max(5, pomodoro.workMin - 5) })}
          onInc={() => setPomodoro({ workMin: Math.min(180, pomodoro.workMin + 5) })}
        />
        <Divider />
        <Stepper
          label="Descanso corto"
          value={pomodoro.shortBreakMin}
          suffix="min"
          onDec={() => setPomodoro({ shortBreakMin: Math.max(1, pomodoro.shortBreakMin - 1) })}
          onInc={() => setPomodoro({ shortBreakMin: Math.min(60, pomodoro.shortBreakMin + 1) })}
        />
        <Divider />
        <Stepper
          label="Descanso largo"
          value={pomodoro.longBreakMin}
          suffix="min"
          onDec={() => setPomodoro({ longBreakMin: Math.max(5, pomodoro.longBreakMin - 5) })}
          onInc={() => setPomodoro({ longBreakMin: Math.min(90, pomodoro.longBreakMin + 5) })}
        />
        <Divider />
        <Stepper
          label="Ciclos hasta largo"
          value={pomodoro.cyclesBeforeLong}
          onDec={() => setPomodoro({ cyclesBeforeLong: Math.max(1, pomodoro.cyclesBeforeLong - 1) })}
          onInc={() => setPomodoro({ cyclesBeforeLong: Math.min(12, pomodoro.cyclesBeforeLong + 1) })}
        />
        <Divider />
        <Stepper
          label="Custom trabajo"
          value={customTimer.workMin}
          suffix="min"
          onDec={() => setCustomTimer({ workMin: Math.max(5, customTimer.workMin - 5) })}
          onInc={() => setCustomTimer({ workMin: Math.min(180, customTimer.workMin + 5) })}
        />
        <Divider />
        <Stepper
          label="Custom descanso"
          value={customTimer.breakMin}
          suffix="min"
          onDec={() => setCustomTimer({ breakMin: Math.max(1, customTimer.breakMin - 1) })}
          onInc={() => setCustomTimer({ breakMin: Math.min(60, customTimer.breakMin + 1) })}
        />
      </Card>
    </View>
  );
}

function Divider() {
  return <View className="ml-4 h-px bg-kibo-border" />;
}

function Row({
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className={`flex-row items-center justify-between p-4 ${disabled ? 'opacity-50' : ''}`}>
      <View className="flex-1">
        <Text className="text-sm text-kibo-text">{label}</Text>
        {hint ? <Text className="mt-0.5 text-xs text-kibo-muted">{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.accentDeep }}
        thumbColor="#f4f4f7"
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  suffix,
  disabled,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  suffix?: string;
  disabled?: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <View className={`flex-row items-center justify-between p-4 ${disabled ? 'opacity-50' : ''}`}>
      <Text className="flex-1 text-sm text-kibo-text">{label}</Text>
      <View className="flex-row items-center gap-3">
        <TouchableOpacity onPress={onDec} disabled={disabled} hitSlop={8}>
          <Icon name="minus-circle" size={22} color={colors.muted} />
        </TouchableOpacity>
        <Text className="w-16 text-center text-sm font-medium text-kibo-text">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </Text>
        <TouchableOpacity onPress={onInc} disabled={disabled} hitSlop={8}>
          <Icon name="plus-circle" size={22} color={colors.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
