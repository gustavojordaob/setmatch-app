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
import { solicitarContaAdminClube } from '../../utils/whatsapp';
import { LegalConsent } from '../../components/legal/LegalConsent';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);

  async function onLogin() {
    if (!aceitouLegal) {
      Alert.alert('Termos', 'Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    if (!email.trim() || !senha) {
      Alert.alert('Admin Clube', 'Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, senha);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Admin Clube', e instanceof Error ? e.message : 'Falha ao entrar.');
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
          <Text style={styles.badge}>ADMIN CLUBE</Text>
          <Text style={styles.title}>Área do dono</Text>
          <Text style={styles.sub}>
            Contas de admin são criadas pela equipe Setmatch após solicitação. Se você já recebeu
            acesso, entre com o e-mail e senha enviados.
          </Text>

          <Input
            label="E-mail"
            placeholder="admin@seuclube.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Input
            label="Senha"
            placeholder="Sua senha"
            value={senha}
            onChangeText={setSenha}
            showPasswordToggle
          />

          <LegalConsent
            accepted={aceitouLegal}
            onToggle={() => setAceitouLegal((v) => !v)}
          />

          <Button
            label="Entrar como admin"
            onPress={onLogin}
            loading={loading}
            disabled={!aceitouLegal}
          />

          <View style={styles.box}>
            <Text style={styles.boxTitle}>Ainda não tem acesso?</Text>
            <Text style={styles.boxTxt}>
              Envie uma solicitação para a Setmatch. Criamos a conta e liberamos o painel do clube
              (torneios, rankings, aulas).
            </Text>
            <Button label="Solicitar acesso admin" onPress={() => void solicitarContaAdminClube()} />
          </View>

          <Text style={styles.back} onPress={() => router.replace('/(auth)/login')}>
            ← Voltar ao login de jogador
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
