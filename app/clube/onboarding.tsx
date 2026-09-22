import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { telefoneSalvoValido } from '../../utils/telefoneInternacional';
import {
  buscarEnderecoPorCep,
  cepCompleto,
  formatarCepDigitando,
} from '../../utils/viacep';

export default function ClubeOnboardingScreen() {
  const router = useRouter();
  const { user, perfil, saveAdminOnboarding } = useAuth();
  const [nome, setNome] = useState(perfil?.nome ?? user?.displayName ?? '');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [estado, setEstado] = useState(perfil?.estado ?? '');
  const [telefone, setTelefone] = useState(perfil?.telefone ?? '');
  const [cep, setCep] = useState(perfil?.cep ?? '');
  const [bairro, setBairro] = useState(perfil?.bairro ?? '');
  const [rua, setRua] = useState(perfil?.rua ?? '');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onCepChange(raw: string) {
    const masked = formatarCepDigitando(raw);
    setCep(masked);
    if (!cepCompleto(masked)) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(masked);
      if (!end) {
        Alert.alert('CEP', 'CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }
      setCidade(end.localidade);
      setEstado(end.uf);
      if (end.bairro) setBairro(end.bairro);
      if (end.logradouro) setRua(end.logradouro);
    } finally {
      setBuscandoCep(false);
    }
  }

  async function continuar() {
    if (!nome.trim() || !telefoneSalvoValido(telefone)) {
      Alert.alert('Admin', 'Informe nome e celular com código do país.');
      return;
    }
    if (!cepCompleto(cep)) {
      Alert.alert('Admin', 'Informe um CEP válido (8 dígitos).');
      return;
    }
    if (!cidade.trim() || !estado.trim()) {
      Alert.alert('Admin', 'Preencha cidade e UF (o CEP preenche automaticamente).');
      return;
    }
    if (!rua.trim() || !bairro.trim()) {
      Alert.alert('Admin', 'Complete o endereço (rua e bairro).');
      return;
    }
    setLoading(true);
    try {
      await saveAdminOnboarding({
        nome,
        cidade,
        estado,
        telefone: telefone.replace(/\D/g, ''),
        cep,
        bairro,
        rua,
      });
      router.replace('/clube/painel');
    } catch (e: unknown) {
      Alert.alert('Admin', e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Bem-vindo, admin</Text>
        <Text style={styles.sub}>
          Informe o CEP para completar o endereço. Depois cadastre o clube, rankings e
          torneios.
        </Text>
        <Input label="Seu nome" value={nome} onChangeText={setNome} />
        <PhoneInput
          label="Celular (WhatsApp)"
          value={telefone}
          onChangeValue={setTelefone}
        />
        <Input
          label="CEP"
          value={cep}
          onChangeText={(t) => void onCepChange(t)}
          keyboardType="number-pad"
          placeholder="00000-000"
        />
        {buscandoCep ? (
          <Text style={styles.hint}>Buscando endereço…</Text>
        ) : null}
        <Input
          label="Rua / logradouro"
          value={rua}
          onChangeText={setRua}
          placeholder="Rua, avenida…"
        />
        <Input label="Bairro" value={bairro} onChangeText={setBairro} />
        <Input label="Cidade" value={cidade} onChangeText={setCidade} placeholder="São Paulo" />
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
  hint: { color: Colors.textSecondary, fontSize: 13, marginTop: -8 },
});
