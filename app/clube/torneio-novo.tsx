import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { ESPORTES, type EsporteId } from '../../constants/esportes';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import { criarTorneioCompleto } from '../../services/torneios';

export default function TorneioNovoScreen() {
  const { clubeId } = useLocalSearchParams<{ clubeId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [esporte, setEsporte] = useState<EsporteId>('tenis');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [cobrar, setCobrar] = useState(true);
  const [valor, setValor] = useState('80.00');
  const [prazo, setPrazo] = useState('');
  const [regras, setRegras] = useState(
    'Inscrição via PIX ou cartão em 1x. Pagamento até a data limite. Sem reembolso após sorteio.'
  );
  const [loading, setLoading] = useState(false);

  async function salvar() {
    if (!clubeId || !nome.trim() || !user) {
      Alert.alert('Torneio', 'Informe o nome do torneio.');
      return;
    }
    const v = Number(String(valor).replace(',', '.')) || 0;
    if (cobrar && v <= 0) {
      Alert.alert('Torneio', 'Informe o valor da inscrição.');
      return;
    }
    setLoading(true);
    try {
      const clubes = await listarClubesDoDono(user.uid);
      const clube = clubes.find((c) => c.id === clubeId) ?? clubes[0];
      if (!clube) {
        Alert.alert('Torneio', 'Clube não encontrado.');
        return;
      }
      await criarTorneioCompleto({
        clubeId: clube.id,
        clubeNome: clube.nome,
        cidade: clube.cidade,
        donoUid: user.uid,
        nome,
        esporte,
        dataInicio,
        dataFim,
        descricao,
        local,
        pagamento: {
          ativo: cobrar,
          valor: v,
          regras: regras.trim(),
          prazoPagamento: prazo.trim(),
          permitePix: true,
          permiteCartao: true,
        },
      });
      Alert.alert('Torneio', 'Torneio criado com regras de pagamento!', [
        { text: 'OK', onPress: () => router.replace('/clube/painel') },
      ]);
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Erro ao criar.');
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
        <Text style={styles.title}>Novo torneio</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Input label="Nome" value={nome} onChangeText={setNome} placeholder="Copa Verão 2026" />
        <Input
          label="Data início (DD/MM/AAAA)"
          value={dataInicio}
          onChangeText={setDataInicio}
          placeholder="01/08/2026"
        />
        <Input
          label="Data fim (DD/MM/AAAA)"
          value={dataFim}
          onChangeText={setDataFim}
          placeholder="15/08/2026"
        />
        <Input label="Local" value={local} onChangeText={setLocal} />
        <Input label="Descrição" value={descricao} onChangeText={setDescricao} />
        <Text style={styles.label}>Esporte</Text>
        <View style={styles.chips}>
          {ESPORTES.map((e) => {
            const on = e.id === esporte;
            return (
              <TouchableOpacity
                key={e.id}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setEsporte(e.id)}
              >
                <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{e.nome}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Cobrar inscrição (PIX / cartão 1x)</Text>
          <Switch value={cobrar} onValueChange={setCobrar} trackColor={{ true: Colors.accent }} />
        </View>
        {cobrar ? (
          <>
            <Input
              label="Valor inscrição (R$)"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
            <Input
              label="Prazo para pagar (DD/MM/AAAA)"
              value={prazo}
              onChangeText={setPrazo}
              placeholder="10/08/2026"
            />
            <Input
              label="Regras do torneio e do pagamento"
              value={regras}
              onChangeText={setRegras}
              multiline
            />
          </>
        ) : null}
      </ScrollView>
      <ButtonFooter>
        <Button label="Criar torneio" onPress={salvar} loading={loading} />
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
  body: { padding: 20, gap: 14, paddingBottom: 40 },
  label: { color: Colors.textPrimary, fontWeight: 'bold', flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
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
