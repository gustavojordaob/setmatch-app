import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';
import { LegalConsent } from '../../components/legal/LegalConsent';
import { adminHomePath } from '../../utils/adminWeb';
import { auth, db } from '../../utils/firebaseConfig';
import type { UserRole } from '../../types/usuario';

function isAdminRole(role: unknown): boolean {
  return role === 'admin_clube' || role === 'professor' || role === 'admin_temporario';
}

export default function AdminLoginScreen() {
  const router = useRouter();
  const { signInWithEmail, signOut } = useAuth();
  const t = useT();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);
  const desktop = Platform.OS === 'web' && width >= 900;

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
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error(t('auth.loginFailed'));
      const snap = await getDoc(doc(db, 'usuarios', uid));
      const role = (snap.data()?.role as UserRole | undefined) ?? 'jogador';
      if (!isAdminRole(role)) {
        await signOut();
        Alert.alert(
          t('auth.adminAlertTitle'),
          Platform.OS === 'web'
            ? 'Esta conta não é de administrador. Use o app Rally Up no celular como jogador.'
            : 'Esta conta não tem perfil de admin. Use o login de jogador.'
        );
        return;
      }
      if (Platform.OS === 'web') {
        router.replace(adminHomePath(true));
      } else {
        router.replace('/');
      }
    } catch (e: unknown) {
      Alert.alert(
        t('auth.adminAlertTitle'),
        e instanceof Error ? e.message : t('auth.loginFailed')
      );
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <ScrollView
      contentContainerStyle={[styles.scroll, desktop && styles.scrollDesktop]}
      keyboardShouldPersistTaps="handled"
    >
      {!desktop ? <Text style={styles.badge}>{t('auth.adminBadge')}</Text> : null}
      <Text style={styles.title}>{t('auth.adminTitle')}</Text>
      <Text style={styles.sub}>
        {Platform.OS === 'web'
          ? 'Acesse o painel do clube no computador — torneios, rankings, aulas e financeiro.'
          : t('auth.adminSubtitle')}
      </Text>

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

      <LegalConsent accepted={aceitouLegal} onToggle={() => setAceitouLegal((v) => !v)} />

      <Button
        label={t('auth.enterAsAdmin')}
        onPress={onLogin}
        loading={loading}
        disabled={!aceitouLegal}
      />

      <Button
        label="Entrar com perfil (admin temporário)"
        variant="outline"
        onPress={() => router.push('/(auth)/admin-perfis')}
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
          variant="outline"
          onPress={() => router.push('/(auth)/solicitar-acesso?tipo=admin_clube')}
        />
      </View>

      {Platform.OS !== 'web' ? (
        <Text style={styles.back} onPress={() => router.replace('/(auth)/login')}>
          {t('auth.backToPlayerLogin')}
        </Text>
      ) : (
        <Text style={styles.backMuted}>Somente contas de admin, professor ou admin temporário.</Text>
      )}
    </ScrollView>
  );

  if (desktop) {
    return (
      <View style={styles.desktopRoot}>
        <View style={styles.heroPane}>
          <Image
            source={require('../../assets/Vector.png')}
            style={styles.heroLogo}
            resizeMode="contain"
          />
          <Text style={styles.heroBrand}>Rally Up</Text>
          <Text style={styles.heroTag}>Painel administrativo</Text>
          <Text style={styles.heroDesc}>
            Gerencie clube, rankings, torneios, agenda, aulas e financeiro em uma experiência feita
            para computador.
          </Text>
        </View>
        <View style={styles.formPane}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
            {form}
          </KeyboardAvoidingView>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {form}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  heroPane: {
    flex: 1.1,
    backgroundColor: Colors.surfaceDark,
    paddingHorizontal: 56,
    paddingVertical: 64,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  heroLogo: { width: 72, height: 72, marginBottom: 20 },
  heroBrand: { color: Colors.accent, fontSize: 42, fontWeight: '800', letterSpacing: -0.5 },
  heroTag: {
    color: Colors.white,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 16,
  },
  heroDesc: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 420,
  },
  formPane: {
    flex: 1,
    maxWidth: 520,
    backgroundColor: Colors.background,
  },
  scroll: { padding: 24, gap: 14, paddingBottom: 40 },
  scrollDesktop: { paddingHorizontal: 40, paddingTop: 48, justifyContent: 'center', flexGrow: 1 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    color: Colors.textOnAccent,
    fontWeight: '800',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: 'hidden',
  },
  title: { color: Colors.white, fontSize: 28, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  box: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    gap: 10,
  },
  boxTitle: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  boxTxt: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  back: {
    color: Colors.accent,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  backMuted: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontSize: 12,
  },
});
