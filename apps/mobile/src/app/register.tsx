// Account registration, mirroring the web Register page (email+password or Google).
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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

export default function RegisterScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Introduce email y contraseña.');
      return;
    }
    if (password.length < 10) {
      setError('La contraseña necesita mínimo 10 caracteres.');
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.register({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      });
      setSession(res);
      // Auth gate redirects to the app.
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_in_use') {
        setError('Ya existe una cuenta con ese email.');
      } else {
        setError('No se pudo crear la cuenta.');
      }
    } finally {
      setBusy(false);
    }
  };

  const submitGoogle = async () => {
    if (googleBusy || busy) return;
    setError(null);
    setGoogleBusy(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) {
        setError('Google no devolvió credenciales. Inténtalo de nuevo.');
        return;
      }
      const res = await authApi.google(idToken);
      setSession(res);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        // user closed the dialog
      } else if (err instanceof ApiError && err.code === 'google_not_configured') {
        setError('Google no está configurado en el servidor.');
      } else {
        setError('No se pudo entrar con Google.');
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-kibo-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
          <View className="mb-8 items-center gap-2">
            <Image
              source={require('../../assets/images/kibo_logo.png')}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
            <Text className="text-2xl font-bold text-kibo-text">Crea tu cuenta</Text>
            <Text className="text-sm text-kibo-muted">Empieza a organizar tu día.</Text>
          </View>

          <View className="gap-3">
            <Field
              icon="user"
              placeholder="Nombre (opcional)"
              value={name}
              onChangeText={setName}
              autoComplete="name"
            />
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
              placeholder="Contraseña (mín. 10)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              onSubmitEditing={submit}
              returnKeyType="go"
            />

            {error ? <Text className="px-1 text-sm text-red-400">{error}</Text> : null}

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={submit}
              disabled={busy}
              className={`mt-1 h-11 items-center justify-center rounded-lg bg-kibo-accentDeep ${
                busy ? 'opacity-60' : ''
              }`}
            >
              <Text className="text-sm font-semibold text-white">
                {busy ? 'Creando…' : 'Crear cuenta'}
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

            <TouchableOpacity onPress={() => router.back()} className="mt-2 items-center py-2">
              <Text className="text-sm text-kibo-muted">
                ¿Ya tienes cuenta? <Text className="font-semibold text-kibo-accent">Entrar</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  icon,
  ...props
}: { icon: 'mail' | 'lock' | 'user' } & React.ComponentProps<typeof TextInput>) {
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
