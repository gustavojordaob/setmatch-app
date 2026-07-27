import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { formatarTelefoneExibicao } from '../../utils/whatsapp';

export default function ClubeOnboardingScreen() {
  const router = useRouter();
  const { user, perfil, saveAdminOnboarding } = useAuth();
  const [nome, setNome] = useState(perfil?.nome ?? user?.displayName ?? '');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [estado, setEstado] = useState(perfil?.estado ?? '');
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '');
  const [loading, setLoading] = useState(false);

  async function continuar() {
    const digits = telefone.replace(/\D/g, '');
    if (!nome.trim() || !cidade.trim() || digits.length < 10) {
      Alert.alert('Admin', 'Informe nome, cidade e celular com DDD.');
      return;
    }
    setLoading(true);
    try {
      await saveAdminOnboarding({ nome, cidade, estado, telefone });
      router.replace('/clube/painel');
    } catch (e: unknown) {
      Alert.alert('Admin', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Bem-vindo, admin</Text>
        <Text style={styles.sub}>
          Complete seus dados de contato. Depois cadastre o clube, rankings e torneios.
        </Text>
        <Input label="Seu nome" value={nome} onChangeText={setNome} />
        <Input
          label="Celular (WhatsApp)"
          value={telefone}
          onChangeText={(t) => setTelefone(formatarTelefoneExibicao(t))}
          keyboardType="phone-pad"
          placeholder="(11) 99999-9999"
        />
        <Input label="Cidade base" value={cidade} onChangeText={setCidade} placeholder="São Paulo" />
        <Input
          label="UF"
          value={estado}
          onChangeText={setEstado}
          maxLength={2}
          autoCapitalize="characters"
          placeholder="SP"
        />
      </ScrollView>
      <ButtonFooter>
        <Button label="Continuar para o painel" onPress={continuar} loading={loading} />
      </ButtonFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  body: { padding: 24, gap: 16 },
  title: { color: Colors.accent, fontSize: 28, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, marginBottom: 8, lineHeight: 20 },
});
