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
import { useT } from '../../hooks/useI18n';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const t = useT();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);

  async function onEmailLogin() {
    if (!aceitouLegal) {
      Alert.alert(t('legal.termsTitle'), t('legal.acceptToContinue'));
      return;
    }
    if (!login.trim() || !senha) {
      Alert.alert(t('auth.login'), t('auth.fillLoginPassword'));
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(login, senha);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert(t('auth.login'), e instanceof Error ? e.message : t('auth.loginFailed'));
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
          <Text style={styles.title}>{t('auth.welcome')}</Text>

          <Input
            label={t('auth.login')}
            placeholder={t('auth.loginPlaceholder')}
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
          />

          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={senha}
            onChangeText={setSenha}
            showPasswordToggle
          />

          <Text
            style={styles.forgot}
            onPress={() => router.push('/(auth)/esqueci-senha')}
          >
            {t('auth.forgotPassword')}
          </Text>

          <LegalConsent
            accepted={aceitouLegal}
            onToggle={() => setAceitouLegal((v) => !v)}
          />

          <Button
            label={t('auth.logIn')}
            onPress={onEmailLogin}
            loading={loading}
            disabled={!aceitouLegal}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.line} />
          </View>

          <AuthSocialRow
            loading={loading}
            disabled={!aceitouLegal}
            onBlocked={() =>
              Alert.alert(t('legal.termsTitle'), t('legal.acceptToContinue'))
            }
          />

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>{t('auth.noAccount')} </Text>
            <Text style={styles.footerLink} onPress={() => router.push('/(auth)/cadastro')}>
              {t('auth.register')}
            </Text>
          </View>

          <Text
            style={styles.adminLink}
            onPress={() => router.push('/(auth)/admin-login')}
          >
            {t('auth.clubOwnerLink')}
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
