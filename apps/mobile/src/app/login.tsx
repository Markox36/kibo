import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import AntDesign from '@expo/vector-icons/AntDesign';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Icon } from '../ui/Icon';
import { colors } from '../theme/colors';
import { authApi } from '../lib/auth-api';
import { ApiError } from '../lib/api';
import { GOOGLE_CLIENT_ID } from '../lib/env';
import { useAuthStore } from '../store/auth';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) {
      GoogleSignin.configure({ webClientId: GOOGLE_CLIENT_ID });
    }
  }, []);

  const submitGoogle = async () => {
    if (googleBusy || busy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // cancelled by user
      const idToken = response.data.idToken;
      if (!idToken) {
        setError('Google no devolvió credenciales. Inténtalo de nuevo.');
        return;
      }
      const res = await authApi.google(idToken);
      setSession(res);
      // Navigation is handled by the auth gate in the root layout.
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user closed the dialog — not an error
      } else if (err instanceof ApiError && err.code === 'google_not_configured') {
        setError('Google no está configurado en el servidor.');
      } else {
        setError('No se pudo entrar con Google.');
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Introduce email y contraseña.');
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.login({ email: email.trim(), password });
      setSession(res);
      // Navigation is handled by the auth gate in the root layout.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid_credentials') {
        setError('Email o contraseña incorrectos.');
      } else {
        setError('No se pudo iniciar sesión. Revisa tu conexión.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-kibo-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 justify-center px-6">
          <View className="mb-8 items-center gap-2">
            <Image
              source={require('../../assets/images/kibo_logo.png')}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
            <Text className="text-2xl font-bold text-kibo-text">Kibo</Text>
            <Text className="text-sm text-kibo-muted">Entra con tu email y contraseña.</Text>
          </View>

          <View className="gap-3">
            <Field
              icon="mail"
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              icon="lock"
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            {error ? (
              <Text className="px-1 text-sm text-red-400">{error}</Text>
            ) : null}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={submit}
              disabled={busy}
              className={`mt-1 h-11 items-center justify-center rounded-lg bg-kibo-accentDeep ${
                busy ? 'opacity-60' : ''
              }`}
            >
              <Text className="text-sm font-semibold text-white">
                {busy ? 'Entrando…' : 'Entrar'}
              </Text>
            </TouchableOpacity>

            {GOOGLE_CLIENT_ID ? (
              <>
                <View className="my-2 flex-row items-center gap-3">
                  <View className="h-px flex-1 bg-kibo-border" />
                  <Text className="text-xs text-kibo-muted">o</Text>
                  <View className="h-px flex-1 bg-kibo-border" />
                </View>

                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={submitGoogle}
                  disabled={googleBusy}
                  className={`h-11 flex-row items-center justify-center gap-2 rounded-lg border border-kibo-border bg-kibo-surface ${
                    googleBusy ? 'opacity-60' : ''
                  }`}
                >
                  <AntDesign name="google" size={16} color={colors.text} />
                  <Text className="text-sm font-semibold text-kibo-text">
                    {googleBusy ? 'Conectando…' : 'Continuar con Google'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            <TouchableOpacity onPress={() => router.push('/register')} className="mt-2 items-center py-2">
              <Text className="text-sm text-kibo-muted">
                ¿No tienes cuenta? <Text className="font-semibold text-kibo-accent">Crear cuenta</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon,
  ...props
}: { icon: 'mail' | 'lock' } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="flex-row items-center gap-2 rounded-lg border border-kibo-border bg-kibo-surface px-3">
      <Icon name={icon} size={18} color={colors.muted} />
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        className="h-11 flex-1 text-sm text-kibo-text"
      />
    </View>
  );
}
