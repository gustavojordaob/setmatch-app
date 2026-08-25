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
import { LegalConsent } from '../../components/legal/LegalConsent';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';

export default function CadastroScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const t = useT();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);

  async function onCadastrar() {
    if (!aceitouLegal) {
      Alert.alert(t('legal.termsTitle'), t('legal.acceptToContinue'));
      return;
    }
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      Alert.alert(t('auth.createAccountTitle'), t('auth.fillSignup'));
      return;
    }
    if (senha !== confirmar) {
      Alert.alert(t('auth.createAccountTitle'), t('auth.passwordsMismatch'));
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, senha, nome.trim());
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert(
        t('auth.createAccountTitle'),
        e instanceof Error ? e.message : t('auth.signupFailed')
      );
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
          <Text style={styles.title}>{t('auth.createAccountTitle')}</Text>

          <Input
            label={t('auth.fullName')}
            placeholder={t('auth.fullNamePlaceholder')}
            value={nome}
            onChangeText={setNome}
          />
          <Input
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={senha}
            onChangeText={setSenha}
            showPasswordToggle
          />
          <Input
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={confirmar}
            onChangeText={setConfirmar}
            showPasswordToggle
          />

          <LegalConsent
            accepted={aceitouLegal}
            onToggle={() => setAceitouLegal((v) => !v)}
          />

          <Button
            label={t('auth.createAccount')}
            onPress={onCadastrar}
            loading={loading}
            disabled={!aceitouLegal}
          />

          <View style={styles.footer}>
            <Text style={styles.footerMuted}>{t('auth.hasAccount')} </Text>
            <Text style={styles.footerLink} onPress={() => router.back()}>
              {t('auth.signIn')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32, gap: 14 },
  title: {
    color: Colors.textPrimary,
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  footerMuted: { color: Colors.textPrimary },
  footerLink: { color: Colors.accent, fontWeight: 'bold' },
});
