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

export default function NovoClubeAdminScreen() {
  const router = useRouter();
  const { user, perfil, refreshPerfil } = useAuth();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState(perfil?.cidade ?? '');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState(perfil?.estado ?? '');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [descricao, setDescricao] = useState('');
  const [esportes, setEsportes] = useState<EsporteId[]>(['tenis']);
  const [loading, setLoading] = useState(false);

  function toggle(id: EsporteId) {
    setEsportes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function salvar() {
    if (!user || !nome.trim() || !cidade.trim() || esportes.length === 0) {
      Alert.alert('Clube', 'Preencha nome, cidade e ao menos um esporte.');
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
        <Input label="Endereço" value={endereco} onChangeText={setEndereco} placeholder="Rua, número" />
        <Input label="Bairro" value={bairro} onChangeText={setBairro} />
        <Input label="Cidade" value={cidade} onChangeText={setCidade} />
        <Input label="UF" value={estado} onChangeText={setEstado} maxLength={2} autoCapitalize="characters" />
        <Input label="CEP" value={cep} onChangeText={setCep} keyboardType="number-pad" />
        <Input label="Telefone / WhatsApp" value={telefone} onChangeText={setTelefone} keyboardType="phone-pad" />
        <Input label="Descrição" value={descricao} onChangeText={setDescricao} placeholder="Quadras, horários…" />
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
