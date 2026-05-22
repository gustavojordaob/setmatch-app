import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function onEmailLogin() {
    if (!email.trim() || !senha) {
      Alert.alert('Login', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, senha);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Login', e instanceof Error ? e.message : 'Falha ao entrar.');
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Google', e instanceof Error ? e.message : 'Falha no Google.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>SETMATCH</Text>
          <Text style={styles.sub}>Entre para desafiar e registrar resultados.</Text>
        </View>

        <View style={styles.form}>
          <TouchableOpacity style={styles.googleBtn} onPress={onGoogle} disabled={loading}>
            <Ionicons name="logo-google" size={20} color={Colors.textOnAccent} />
            <Text style={styles.googleLabel}>Continuar com Google</Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>ou e-mail</Text>
            <View style={styles.line} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />

          <Text style={styles.forgot} onPress={() => router.push('/(auth)/esqueci-senha')}>
            Esqueci minha senha
          </Text>

          <Button
            title="Entrar"
            variant="primary"
            onPress={onEmailLogin}
            loading={loading}
            disabled={!email || !senha}
          />

          <Text style={styles.link} onPress={() => router.push('/(auth)/cadastro')}>
            Criar conta
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, paddingHorizontal: 20 },
  header: { marginTop: 24, marginBottom: 28 },
  logo: { ...Typography.userName, color: Colors.accent, fontSize: 32, letterSpacing: 2 },
  sub: { color: Colors.textSecondary, marginTop: 10, lineHeight: 20 },
  form: { gap: 12 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  googleLabel: { color: Colors.textOnAccent, fontWeight: '800', fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textSecondary, fontWeight: '700', fontSize: 12 },
  forgot: {
    color: Colors.accent,
    textAlign: 'right',
    fontWeight: '700',
    fontSize: 13,
  },
  link: {
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '800',
  },
});
