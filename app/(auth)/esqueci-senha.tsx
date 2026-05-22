import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';

export default function EsqueciSenhaScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function enviar() {
    if (!email.trim()) {
      Alert.alert('E-mail', 'Informe seu e-mail.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert('Enviado', 'Verifique sua caixa de entrada para redefinir a senha.');
      router.back();
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível enviar.');
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
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Esqueceu a sua senha?</Text>
          <Text style={styles.sub}>
            Digite o seu endereço de email e enviaremos um link para resetar a sua senha
          </Text>

          <Input
            label="Endereço de Email"
            placeholder="Digite o seu email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Button label="Enviar link" onPress={enviar} loading={loading} />

          <Text style={styles.back} onPress={() => router.back()}>
            Voltar para Login
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32, gap: 20 },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sub: {
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
    opacity: 0.95,
  },
  back: {
    color: Colors.accent,
    textAlign: 'center',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
});
