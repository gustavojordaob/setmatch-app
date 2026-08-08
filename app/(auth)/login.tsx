import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthSocialRow } from '../../components/auth/AuthSocialRow';
import { LegalConsent } from '../../components/legal/LegalConsent';
import { useAuth } from '../../hooks/useAuth';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);

  async function onEmailLogin() {
    if (!aceitouLegal) {
      Alert.alert('Termos', 'Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    if (!login.trim() || !senha) {
      Alert.alert('Login', 'Preencha login e senha.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(login, senha);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Login', e instanceof Error ? e.message : 'Falha ao entrar.');
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Bem Vindo!</Text>

          <Input
            label="Login"
            placeholder="Digite seu email our nome de usuário"
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
          />

          <Input
            label="Senha"
            placeholder="Digite A sua senha"
            value={senha}
            onChangeText={setSenha}
            showPasswordToggle
          />

          <Text
            style={styles.forgot}
            onPress={() => router.push('/(auth)/esqueci-senha')}
          >
            Esqueceu sua senha?
          </Text>

          <LegalConsent
            accepted={aceitouLegal}
            onToggle={() => setAceitouLegal((v) => !v)}
          />

          <Button
            label="Log In"
            onPress={onEmailLogin}
            loading={loading}
            disabled={!aceitouLegal}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.line} />
          </View>

          <AuthSocialRow
            loading={loading}
            disabled={!aceitouLegal}
            onBlocked={() =>
              Alert.alert(
                'Termos',
                'Aceite os Termos de Uso e a Política de Privacidade para continuar.'
              )
            }
          />

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>Não tem uma conta? </Text>
            <Text style={styles.footerLink} onPress={() => router.push('/(auth)/cadastro')}>
              Registre-se
            </Text>
          </View>

          <Text
            style={styles.adminLink}
            onPress={() => router.push('/(auth)/admin-login')}
          >
            Sou dono de clube — já tenho acesso admin
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 16 },
  title: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  forgot: {
    color: Colors.accent,
    textAlign: 'right',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    fontSize: 14,
  },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: Colors.white },
  dividerText: { color: Colors.white, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' },
  footerMuted: { color: Colors.textPrimary },
  footerLink: { color: Colors.accent, fontWeight: 'bold' },
  adminLink: {
    color: Colors.accent,
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
