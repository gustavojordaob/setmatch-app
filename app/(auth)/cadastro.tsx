import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';

export default function CadastroScreen() {
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function onCadastrar() {
    if (!email.trim() || senha.length < 6) {
      Alert.alert('Cadastro', 'Informe e-mail e senha com pelo menos 6 caracteres.');
      return;
    }
    setLoading(true);
    try {
      await signUpWithEmail(email, senha);
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
        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.sub}>Depois você completa seu perfil no app.</Text>

        <View style={styles.form}>
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
            placeholder="Senha (mín. 6)"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />
          <Button title="Cadastrar" variant="primary" onPress={onCadastrar} loading={loading} />
          <Text style={styles.back} onPress={() => router.back()}>
            Voltar ao login
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary },
  sub: { color: Colors.textSecondary, marginTop: 8, marginBottom: 20, lineHeight: 20 },
  form: { gap: 12 },
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
  back: { color: Colors.accent, textAlign: 'center', marginTop: 8, fontWeight: '700' },
});
