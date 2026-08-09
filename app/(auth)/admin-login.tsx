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
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';
import { LegalConsent } from '../../components/legal/LegalConsent';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);

  async function onLogin() {
    if (!aceitouLegal) {
      Alert.alert(t('legal.termsTitle'), t('legal.acceptToContinue'));
      return;
    }
    if (!email.trim() || !senha) {
      Alert.alert(t('auth.adminAlertTitle'), t('auth.adminFillCredentials'));
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, senha);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert(
        t('auth.adminAlertTitle'),
        e instanceof Error ? e.message : t('auth.loginFailed')
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.badge}>{t('auth.adminBadge')}</Text>
          <Text style={styles.title}>{t('auth.adminTitle')}</Text>
          <Text style={styles.sub}>{t('auth.adminSubtitle')}</Text>

          <Input
            label={t('auth.email')}
            placeholder={t('auth.adminEmailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label={t('auth.password')}
            placeholder={t('auth.yourPassword')}
            value={senha}
            onChangeText={setSenha}
            showPasswordToggle
          />

          <LegalConsent
            accepted={aceitouLegal}
            onToggle={() => setAceitouLegal((v) => !v)}
          />

          <Button
            label={t('auth.enterAsAdmin')}
            onPress={onLogin}
            loading={loading}
            disabled={!aceitouLegal}
          />

          <View style={styles.box}>
            <Text style={styles.boxTitle}>{t('auth.adminNoAccessTitle')}</Text>
            <Text style={styles.boxTxt}>{t('auth.adminNoAccessBody')}</Text>
            <Button
              label={t('auth.requestAsProfessor')}
              onPress={() => router.push('/(auth)/solicitar-acesso?tipo=professor')}
            />
            <Button
              label={t('auth.requestAdminAccess')}
              onPress={() => router.push('/(auth)/solicitar-acesso?tipo=admin_clube')}
            />
          </View>

          <Text style={styles.back} onPress={() => router.replace('/(auth)/login')}>
            {t('auth.backToPlayerLogin')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 16 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    color: Colors.textOnAccent,
    fontWeight: 'bold',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: { color: Colors.textPrimary, fontSize: 32, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, fontSize: 14, marginBottom: 8, lineHeight: 20 },
  box: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  boxTitle: { color: Colors.accent, fontWeight: 'bold', fontSize: 15 },
  boxTxt: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  back: {
    color: Colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
    textDecorationLine: 'underline',
  },
});
