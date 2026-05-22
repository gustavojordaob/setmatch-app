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

export default function EsqueciSenhaScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function enviar() {
    if (!email.trim()) {
      Alert.alert('Recuperar senha', 'Informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert(
        'E-mail enviado',
        'Verifique sua caixa de entrada para redefinir a senha.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar o e-mail.');
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
        <Text style={styles.title}>Esqueci minha senha</Text>
        <Text style={styles.sub}>
          Enviaremos um link para redefinir sua senha no e-mail cadastrado.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="E-mail"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Button title="Enviar link" variant="primary" onPress={enviar} loading={loading} />
        <Text style={styles.back} onPress={() => router.back()}>
          Voltar ao login
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1, paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary },
  sub: { color: Colors.textSecondary, lineHeight: 20 },
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
