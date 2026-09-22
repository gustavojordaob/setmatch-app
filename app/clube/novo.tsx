import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { EsporteIcon } from '../../components/EsporteIcon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { criarClube } from '../../services/clubes';
import {
  buscarEnderecoPorCep,
  cepCompleto,
  formatarCepDigitando,
} from '../../utils/viacep';

export default function NovoClubeAdminScreen() {
  const router = useRouter();
  const { user, perfil, refreshPerfil } = useAuth();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [bairro, setBairro] = useState(perfil?.bairro ?? '');
  const [estado, setEstado] = useState(perfil?.estado ?? '');
  const [cep, setCep] = useState(perfil?.cep ?? '');
  const [endereco, setEndereco] = useState(perfil?.rua ?? '');
  const [telefone, setTelefone] = useState('');
  const [descricao, setDescricao] = useState('');
  const [esportes, setEsportes] = useState<EsporteId[]>(['tenis']);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [loading, setLoading] = useState(false);

  function toggle(id: EsporteId) {
    setEsportes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onCepChange(raw: string) {
    const masked = formatarCepDigitando(raw);
    setCep(masked);
    if (!cepCompleto(masked)) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(masked);
      if (!end) {
        Alert.alert('CEP', 'CEP não encontrado. Complete o endereço manualmente.');
        return;
      }
      setCidade(end.localidade);
      setEstado(end.uf);
      if (end.bairro) setBairro(end.bairro);
      if (end.logradouro) setEndereco(end.logradouro);
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar() {
    if (!user || !nome.trim() || esportes.length === 0) {
      Alert.alert('Clube', 'Preencha nome e ao menos um esporte.');
      return;
    }
    if (!cepCompleto(cep)) {
      Alert.alert('Clube', 'Informe um CEP válido.');
      return;
    }
    if (!cidade.trim() || !estado.trim() || !endereco.trim() || !bairro.trim()) {
      Alert.alert(
        'Clube',
        'Complete o endereço (rua, bairro, cidade e UF). O CEP preenche o que faltar.'
      );
      return;
    }
    setLoading(true);
    try {
      await criarClube({
        nome,
        cidade,
        bairro,
        estado,
        cep,
        endereco,
        telefone,
        descricao,
        esportes,
        donoUid: user.uid,
        donoNome: perfil?.nome ?? user.displayName ?? 'Admin',
      });
      await refreshPerfil();
      router.replace('/clube/painel');
    } catch (e: unknown) {
      Alert.alert('Clube', e instanceof Error ? e.message : 'Erro ao criar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Cadastrar clube</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input label="Nome do clube" value={nome} onChangeText={setNome} placeholder="Arena Tennis SP" />
        <Input
          label="CEP"
          value={cep}
          onChangeText={(t) => void onCepChange(t)}
          keyboardType="number-pad"
          placeholder="00000-000"
        />
        {buscandoCep ? <Text style={styles.hint}>Buscando endereço…</Text> : null}
        <Input
          label="Endereço"
          value={endereco}
          onChangeText={setEndereco}
          placeholder="Rua, número"
        />
        <Input label="Bairro" value={bairro} onChangeText={setBairro} />
        <Input label="Cidade" value={cidade} onChangeText={setCidade} />
        <Input
          label="UF"
          value={estado}
          onChangeText={setEstado}
          maxLength={2}
          autoCapitalize="characters"
        />
        <Input
          label="Telefone / WhatsApp"
          value={telefone}
          onChangeText={setTelefone}
          keyboardType="phone-pad"
        />
        <Input
          label="Descrição"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Quadras, horários…"
        />
        <Text style={styles.label}>Esportes do clube</Text>
        <View style={styles.chips}>
          {ESPORTES.map((e) => {
            const on = esportes.includes(e.id);
            return (
              <TouchableOpacity
                key={e.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => toggle(e.id)}
              >
                <EsporteIcon
                  id={e.id}
                  size={16}
                  color={on ? Colors.textOnAccent : Colors.textPrimary}
                />
                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{e.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <ButtonFooter>
        <Button label="Salvar clube" onPress={salvar} loading={loading} />
      </ButtonFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 20, gap: 14, paddingBottom: 24 },
  hint: { color: Colors.textSecondary, fontSize: 13, marginTop: -6 },
  label: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '600' },
  chipTxtOn: { color: Colors.textOnAccent },
});
