import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import {
  TIPOS_MODALIDADE_AULA,
  atualizarModalidadeAula,
  criarModalidadeAula,
  excluirModalidadeAula,
  listarModalidadesAula,
  type ModalidadeAula,
  type TipoModalidadeAula,
} from '../../services/aulas';
import { ESPORTES, type EsporteId } from '../../constants/esportes';

export default function AulasModalidadesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [clubeId, setClubeId] = useState<string>();
  const [lista, setLista] = useState<ModalidadeAula[]>([]);
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [tipo, setTipo] = useState<TipoModalidadeAula>('individual');
  const [esporte, setEsporte] = useState<EsporteId>('tenis');
  const [descricao, setDescricao] = useState('');
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    const clubes = await listarClubesDoDono(user.uid);
    if (!clubes[0]) return;
    setClubeId(clubes[0].id);
    setLista(await listarModalidadesAula(clubes[0].id));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function salvar() {
    if (!clubeId || !nome.trim()) {
      Alert.alert('Aulas', 'Informe o nome da modalidade.');
      return;
    }
    const v = Number(String(valor).replace(',', '.')) || 0;
    if (v <= 0) {
      Alert.alert('Aulas', 'Informe o valor mensal.');
      return;
    }
    setBusy(true);
    try {
      await criarModalidadeAula(clubeId, {
        nome: nome.trim(),
        tipo,
        esporte,
        valorMensal: v,
        ativo: true,
        descricao: descricao.trim() || undefined,
      });
      setNome('');
      setValor('');
      setDescricao('');
      await carregar();
      Alert.alert('Aulas', 'Modalidade cadastrada.');
    } catch (e: unknown) {
      Alert.alert('Aulas', e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function toggleAtivo(m: ModalidadeAula) {
    if (!clubeId) return;
    await atualizarModalidadeAula(clubeId, m.id, { ativo: !m.ativo });
    await carregar();
  }

  async function remover(m: ModalidadeAula) {
    if (!clubeId) return;
    Alert.alert('Excluir', `Remover "${m.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => void excluirModalidadeAula(clubeId, m.id).then(carregar),
      },
    ]);
  }

  const formHeader = (
    <View style={styles.form}>
      <Text style={styles.hint}>
        Cadastre individual, trio, quatro, spozinho, beach etc. Depois vincule ao aluno com
        desconto se quiser. Role a tela para ver todas as modalidades.
      </Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: Trio tênis manhã"
        placeholderTextColor={Colors.textSecondary}
        value={nome}
        onChangeText={setNome}
      />

      <Text style={styles.label}>Tipo</Text>
      <View style={styles.chips}>
        {TIPOS_MODALIDADE_AULA.map((t) => {
          const on = t.id === tipo;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setTipo(t.id)}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                {e.emoji} {e.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Valor mensal (R$)</Text>
      <TextInput
        style={styles.input}
        placeholder="280"
        placeholderTextColor={Colors.textSecondary}
        keyboardType="decimal-pad"
        value={valor}
        onChangeText={setValor}
      />

      <Text style={styles.label}>Descrição (opcional)</Text>
      <TextInput
        style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
        placeholder="Horário, nível, local…"
        placeholderTextColor={Colors.textSecondary}
        multiline
        value={descricao}
        onChangeText={setDescricao}
      />

      <Button label="Cadastrar modalidade" onPress={() => void salvar()} loading={busy} />

      <Text style={[styles.section, { marginTop: 24 }]}>
        Cadastradas ({lista.length})
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Modalidades de aula</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={lista}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={formHeader}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhuma modalidade ainda — cadastre acima.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.meta}>
                  {TIPOS_MODALIDADE_AULA.find((t) => t.id === item.tipo)?.label} ·{' '}
                  {ESPORTES.find((e) => e.id === item.esporte)?.nome} · R${' '}
                  {item.valorMensal.toFixed(2)}
                </Text>
                {item.descricao ? (
                  <Text style={styles.desc} numberOfLines={2}>
                    {item.descricao}
                  </Text>
                ) : null}
              </View>
              <Switch
                value={item.ativo}
                onValueChange={() => void toggleAtivo(item)}
                trackColor={{ true: Colors.accent }}
              />
              <TouchableOpacity onPress={() => void remover(item)} hitSlop={8}>
                <Ionicons name="trash-outline" size={20} color={Colors.white} />
              </TouchableOpacity>
            </View>
          )}
        />
      </KeyboardAvoidingView>
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
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 17 },
  form: { padding: 16, gap: 8 },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  label: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 6 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  chipTxtOn: { color: Colors.textOnAccent },
  section: { color: Colors.textPrimary, fontWeight: 'bold', marginBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 72,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  desc: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },
  empty: { color: Colors.textSecondary, textAlign: 'center', padding: 24 },
});
