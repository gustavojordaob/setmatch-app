import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
import { matricularAlunoPorId } from '../../services/pagamentos';
import { useMatriculasDoClube } from '../../hooks/usePagamentos';
import {
  calcValorComDesconto,
  listarModalidadesAula,
  type ModalidadeAula,
} from '../../services/aulas';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import { abrirWhatsApp } from '../../utils/whatsapp';

export default function AlunosClubeScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [clubeId, setClubeId] = useState<string>();
  const [clubeNome, setClubeNome] = useState('');
  const [setmatchId, setSetmatchId] = useState('');
  const [desconto, setDesconto] = useState('0');
  const [modalidadeId, setModalidadeId] = useState<string>();
  const [modalidades, setModalidades] = useState<ModalidadeAula[]>([]);
  const [busy, setBusy] = useState(false);
  const { matriculas, loading } = useMatriculasDoClube(clubeId);

  const modalidade = useMemo(
    () => modalidades.find((m) => m.id === modalidadeId),
    [modalidades, modalidadeId]
  );

  const valorFinal = useMemo(() => {
    if (!modalidade) return 0;
    return calcValorComDesconto(modalidade.valorMensal, Number(desconto.replace(',', '.')) || 0);
  }, [modalidade, desconto]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void listarClubesDoDono(user.uid).then(async (list) => {
        if (!list[0]) return;
        setClubeId(list[0].id);
        setClubeNome(list[0].nome);
        try {
          const mods = await listarModalidadesAula(list[0].id);
          setModalidades(mods.filter((m) => m.ativo));
          if (mods[0]) setModalidadeId(mods[0].id);
        } catch {
          setModalidades([]);
        }
      });
    }, [user])
  );

  async function adicionar() {
    if (!user || !clubeId) return;
    if (!setmatchId.trim()) {
      Alert.alert('Aluno', 'Informe o ID Setmatch (ex: SM-JOG001).');
      return;
    }
    setBusy(true);
    try {
      const desc = Number(String(desconto).replace(',', '.')) || 0;
      const m = await matricularAlunoPorId({
        clubeId,
        clubeNome,
        donoUid: user.uid,
        setmatchId,
        modalidadeId: modalidade?.id,
        modalidadeNome: modalidade?.nome,
        valorBase: modalidade?.valorMensal ?? 0,
        descontoPercent: desc,
        valorFinal: modalidade ? calcValorComDesconto(modalidade.valorMensal, desc) : 0,
        status: 'ativo',
      });
      Alert.alert(
        'Aluno',
        `${m.nome} (${m.setmatchId}) adicionado` +
          (modalidade ? `\n${modalidade.nome} · R$ ${valorFinal.toFixed(2)}/mês` : '')
      );
      setSetmatchId('');
      setDesconto('0');
    } catch (e: unknown) {
      Alert.alert('Aluno', e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function msgAluno(uid: string, nome: string) {
    if (!user || !perfil) return;
    try {
      const id = await abrirOuCriarConversaAmigo({
        uidA: user.uid,
        nomeA: perfil.nome,
        uidB: uid,
        nomeB: nome,
      });
      await enviarMensagem({
        conversaId: id,
        deUid: user.uid,
        deNome: perfil.nome,
        texto: `Olá ${nome}! Mensagem do clube ${clubeNome}.`,
      });
      router.push(`/chat/${id}`);
    } catch (e: unknown) {
      Alert.alert('Mensagem', e instanceof Error ? e.message : 'Falha ao abrir chat');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Alunos</Text>
        <TouchableOpacity onPress={() => router.push('/clube/aulas-modalidades')}>
          <Ionicons name="school-outline" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.addBox}
        >
          <Text style={styles.hint}>
            Digite o ID do jogador (ex: SM-JOG001), escolha a modalidade e um desconto se precisar.
          </Text>

          <Text style={styles.label}>ID Setmatch</Text>
          <TextInput
            style={styles.input}
            placeholder="SM-XXXXXX"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="characters"
            autoCorrect={false}
            value={setmatchId}
            onChangeText={setSetmatchId}
          />

          <Text style={styles.label}>Modalidade de aula</Text>
          {modalidades.length === 0 ? (
            <TouchableOpacity
              style={styles.warnBox}
              onPress={() => router.push('/clube/aulas-modalidades')}
            >
              <Text style={styles.warnTxt}>
                Cadastre modalidades primeiro (individual, trio, beach…). Toque aqui.
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.chipsWrap}>
              {modalidades.map((m) => {
                const on = m.id === modalidadeId;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setModalidadeId(m.id)}
                  >
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>
                      {m.nome} · R$ {m.valorMensal.toFixed(0)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Desconto do aluno (%)</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="decimal-pad"
            value={desconto}
            onChangeText={setDesconto}
          />
          {modalidade ? (
            <Text style={styles.preview}>
              Valor: R$ {modalidade.valorMensal.toFixed(2)} →{' '}
              <Text style={styles.previewAccent}>R$ {valorFinal.toFixed(2)}/mês</Text>
            </Text>
          ) : null}

          <Button label="Adicionar aluno" onPress={adicionar} loading={busy} />
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 16 }} />
        ) : (
          <FlatList
            data={matriculas}
            keyExtractor={(i) => i.id}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={<Text style={styles.section}>Alunos do clube</Text>}
            ListEmptyComponent={<Text style={styles.empty}>Nenhum aluno ainda.</Text>}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/jogador/${item.uid}`)}
                >
                  <Text style={styles.nome}>{item.nome}</Text>
                  <Text style={styles.meta}>
                    {item.setmatchId} · {item.status}
                  </Text>
                  {item.modalidadeNome ? (
                    <Text style={styles.meta}>
                      {item.modalidadeNome}
                      {item.valorFinal != null
                        ? ` · R$ ${Number(item.valorFinal).toFixed(2)}`
                        : ''}
                      {item.descontoPercent
                        ? ` (−${item.descontoPercent}%)`
                        : ''}
                    </Text>
                  ) : null}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void msgAluno(item.uid, item.nome)}>
                  <Ionicons name="chatbubble-ellipses" size={22} color={Colors.accent} />
                </TouchableOpacity>
                {item.telefone ? (
                  <TouchableOpacity
                    onPress={() =>
                      void abrirWhatsApp(
                        item.telefone!,
                        `Olá ${item.nome}! Aqui é o clube ${clubeNome}.`
                      )
                    }
                  >
                    <Ionicons name="logo-whatsapp" size={22} color={Colors.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          />
        )}
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
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  addBox: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginBottom: 4 },
  label: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13, marginTop: 4 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 48,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
  preview: { color: Colors.textSecondary, fontSize: 13 },
  previewAccent: { color: Colors.accent, fontWeight: '800' },
  warnBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  warnTxt: { color: Colors.accent, fontSize: 13 },
  section: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 15,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
});
