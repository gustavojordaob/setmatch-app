import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { PhoneInput } from '../../components/ui/PhoneInput';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { atualizarClube } from '../../services/clubes';
import { telefoneSalvoValido } from '../../utils/telefoneInternacional';

export default function EditarClubeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [bairro, setBairro] = useState('');
  const [estado, setEstado] = useState('');
  const [cep, setCep] = useState('');
  const [endereco, setEndereco] = useState('');
  const [telefone, setTelefone] = useState('');
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const snap = await getDoc(doc(db, 'clubes', id));
      if (!snap.exists()) return;
      const d = snap.data();
      setNome(String(d.nome ?? ''));
      setCidade(String(d.cidade ?? ''));
      setBairro(String(d.bairro ?? ''));
      setEstado(String(d.estado ?? ''));
      setCep(String(d.cep ?? ''));
      setEndereco(String(d.endereco ?? ''));
      setTelefone(String(d.telefone ?? ''));
      setDescricao(String(d.descricao ?? ''));
    })();
  }, [id]);

  async function salvar() {
    if (!id) return;
    if (telefone && !telefoneSalvoValido(telefone)) {
      Alert.alert('Clube', 'Telefone inválido — use código do país + DDD.');
      return;
    }
    setLoading(true);
    try {
      await atualizarClube(id, {
        nome: nome.trim(),
        cidade: cidade.trim(),
        bairro: bairro.trim(),
        estado: estado.trim().toUpperCase(),
        cep: cep.trim(),
        endereco: endereco.trim(),
        telefone: telefone.replace(/\D/g, ''),
        descricao: descricao.trim(),
      });
      router.back();
    } catch (e: unknown) {
      Alert.alert('Clube', e instanceof Error ? e.message : 'Erro ao salvar.');
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
        <Text style={styles.title}>Editar clube</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Input label="Nome" value={nome} onChangeText={setNome} />
        <Input label="Endereço" value={endereco} onChangeText={setEndereco} />
        <Input label="Bairro" value={bairro} onChangeText={setBairro} />
        <Input label="Cidade" value={cidade} onChangeText={setCidade} />
        <Input label="UF" value={estado} onChangeText={setEstado} maxLength={2} />
        <Input label="CEP" value={cep} onChangeText={setCep} />
        <PhoneInput label="Telefone (WhatsApp)" value={telefone} onChangeValue={setTelefone} />
        <Input label="Descrição" value={descricao} onChangeText={setDescricao} />
      </ScrollView>
      <ButtonFooter>
        <Button label="Salvar" onPress={salvar} loading={loading} />
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
  body: { padding: 20, gap: 14 },
});
