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

export default function CadastroScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [aceitouLegal, setAceitouLegal] = useState(false);

  async function onCadastrar() {
    if (!aceitouLegal) {
      Alert.alert('Termos', 'Aceite os Termos de Uso e a Política de Privacidade para continuar.');
      return;
    }
    if (!nome.trim() || !email.trim() || senha.length < 6) {
      Alert.alert('Cadastro', 'Preencha nome, e-mail e senha (mín. 6).');
      return;
    }
    if (senha !== confirmar) {
      Alert.alert('Cadastro', 'As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, senha, nome.trim());
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Cadastro', e instanceof Error ? e.message : 'Não foi possível criar a conta.');
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
          <Text style={styles.title}>Criar Conta</Text>

          <Input
            label="Nome Completo"
            placeholder="Digite o seu nome completo"
            value={nome}
            onChangeText={setNome}
          />
          <Input
            label="Email"
            placeholder="Digite o seu email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Senha"
            placeholder="Digite a sua senha"
            value={senha}
            onChangeText={setSenha}
            showPasswordToggle
          />
          <Input
            label="Confirmar Senha"
            placeholder="Confirme a sua senha"
            value={confirmar}
            onChangeText={setConfirmar}
            showPasswordToggle
          />

          <LegalConsent
            accepted={aceitouLegal}
            onToggle={() => setAceitouLegal((v) => !v)}
          />

          <Button
            label="Criar Conta"
            onPress={onCadastrar}
            loading={loading}
            disabled={!aceitouLegal}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
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
            <Text style={styles.footerMuted}>Já tem uma conta? </Text>
            <Text style={styles.footerLink} onPress={() => router.back()}>
              Entrar
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  line: { flex: 1, height: 1, backgroundColor: Colors.white },
  dividerText: { color: Colors.white, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 12 },
  footerMuted: { color: Colors.textPrimary },
  footerLink: { color: Colors.accent, fontWeight: 'bold' },
});
