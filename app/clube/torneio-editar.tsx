import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../utils/firebaseConfig';
import {
  atualizarDadosTorneio,
  type Torneio,
} from '../../services/torneios';
import {
  DEFINICOES_CHAVE,
  ESTRUTURAS_MATA,
  FORMATOS_PARTIDA_TORNEIO,
  type DefinicaoChaveId,
  type EstruturaMataId,
  type FormatoPartidaTorneioId,
} from '../../constants/chaveamentosTorneio';
import { maskDateBR, maskTimeHHMM } from '../../utils/mascaras';
import {
  labelComposicao,
  type ComposicaoId,
} from '../../constants/composicao';

export default function TorneioEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [horarioPadrao, setHorarioPadrao] = useState('');
  const [quadraNome, setQuadraNome] = useState('');
  const [resultadoSoOrganizador, setResultadoSoOrganizador] = useState(false);
  const [cobrar, setCobrar] = useState(false);
  const [valor, setValor] = useState('0');
  const [regrasPag, setRegrasPag] = useState('');
  const [prazo, setPrazo] = useState('');
  const [descontoMultiCat, setDescontoMultiCat] = useState('0');
  const [composicao, setComposicao] = useState<ComposicaoId>('simples');
  const [formatoPartidaId, setFormatoPartidaId] =
    useState<FormatoPartidaTorneioId>('melhor_de_3_stb');
  const [estruturaMata, setEstruturaMata] = useState<EstruturaMataId>(8);
  const [definicaoChave, setDefinicaoChave] = useState<DefinicaoChaveId>('sorteio');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'torneios', id));
        if (!snap.exists()) {
          Alert.alert('Torneio', 'Não encontrado.');
          router.back();
          return;
        }
        const raw = snap.data();
        if (user && String(raw.donoUid ?? '') !== user.uid) {
          Alert.alert('Torneio', 'Só o organizador pode editar.');
          router.back();
          return;
        }
        setNome(String(raw.nome ?? ''));
        setDataInicio(String(raw.dataInicio ?? ''));
        setDataFim(String(raw.dataFim ?? ''));
        setLocal(String(raw.local ?? ''));
        setDescricao(String(raw.descricao ?? ''));
        setHorarioPadrao(String(raw.horarioPadrao ?? ''));
        setQuadraNome(String(raw.quadraNome ?? ''));
        setResultadoSoOrganizador(Boolean(raw.resultadoSoOrganizador));
        setComposicao((raw.composicao as ComposicaoId) || 'simples');
        setFormatoPartidaId(
          (raw.formatoPartidaId as FormatoPartidaTorneioId) || 'melhor_de_3_stb'
        );
        setEstruturaMata((Number(raw.estruturaMata) as EstruturaMataId) || 8);
        setDefinicaoChave((raw.definicaoChave as DefinicaoChaveId) || 'sorteio');
        const pag = raw.pagamento as Torneio['pagamento'] | undefined;
        setCobrar(Boolean(pag?.ativo));
        setValor(String(pag?.valor ?? 0));
        setRegrasPag(String(pag?.regras ?? ''));
        setPrazo(String(pag?.prazoPagamento ?? ''));
        setDescontoMultiCat(String(pag?.descontoMultiCategoriaValor ?? 0));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, router]);

  async function onSalvar() {
    if (!id) return;
    setSaving(true);
    try {
      const valorNum = Number(String(valor).replace(',', '.')) || 0;
      await atualizarDadosTorneio(id, {
        nome,
        dataInicio,
        dataFim,
        local,
        descricao,
        horarioPadrao,
        quadraNome,
        resultadoSoOrganizador,
        composicao,
        formatoPartidaId,
        estruturaMata,
        definicaoChave,
        pagamento: {
          ativo: cobrar && valorNum > 0,
          valor: valorNum,
          regras: regrasPag.trim(),
          prazoPagamento: prazo.trim(),
          permitePix: true,
          permiteCartao: true,
          descontoPixPercent: 0,
          descontoCartaoPercent: 0,
          descontoMultiCategoriaValor:
            Number(String(descontoMultiCat).replace(',', '.')) || 0,
        },
      });
      Alert.alert('Torneio', 'Alterações salvas. Categorias e chaves: na tela do torneio.');
      router.replace(`/torneio/${id}`);
    } catch (e: unknown) {
      Alert.alert('Torneio', e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar torneio</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Input label="Nome" value={nome} onChangeText={setNome} />
        <Input
          label="Data início (DD/MM/AAAA)"
          value={dataInicio}
          onChangeText={(t) => setDataInicio(maskDateBR(t))}
          placeholder="25/09/2026"
          keyboardType="number-pad"
          maxLength={10}
        />
        <Input
          label="Data fim (DD/MM/AAAA)"
          value={dataFim}
          onChangeText={(t) => setDataFim(maskDateBR(t))}
          placeholder="28/09/2026"
          keyboardType="number-pad"
          maxLength={10}
        />
        <Input label="Local" value={local} onChangeText={setLocal} />
        <Input
          label="Descrição"
          value={descricao}
          onChangeText={setDescricao}
          multiline
        />
        <Input
          label="Horário ref."
          value={horarioPadrao}
          onChangeText={(t) => setHorarioPadrao(maskTimeHHMM(t))}
          placeholder="09:00"
          keyboardType="number-pad"
          maxLength={5}
        />
        <Input label="Quadra (opcional)" value={quadraNome} onChangeText={setQuadraNome} />

        <Text style={styles.section}>Composição padrão (categorias podem sobrescrever)</Text>
        <View style={styles.chips}>
          {(['simples', 'dupla'] as ComposicaoId[]).map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, composicao === c && styles.chipOn]}
              onPress={() => setComposicao(c)}
            >
              <Text style={[styles.chipTxt, composicao === c && styles.chipTxtOn]}>
                {labelComposicao(c)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Formato de partida (sets)</Text>
        <View style={styles.chips}>
          {FORMATOS_PARTIDA_TORNEIO.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, formatoPartidaId === f.id && styles.chipOn]}
              onPress={() => setFormatoPartidaId(f.id)}
            >
              <Text
                style={[styles.chipTxt, formatoPartidaId === f.id && styles.chipTxtOn]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          Ex.: &quot;2 sets + STB&quot; abre o super tiebreak até 10 quando fica 1–1.
        </Text>

        <Text style={styles.section}>Tamanho da chave (mata-mata)</Text>
        <View style={styles.chips}>
          {ESTRUTURAS_MATA.map((e) => (
            <TouchableOpacity
              key={e.id}
              style={[styles.chip, estruturaMata === e.id && styles.chipOn]}
              onPress={() => setEstruturaMata(e.id)}
            >
              <Text style={[styles.chipTxt, estruturaMata === e.id && styles.chipTxtOn]}>
                {e.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.section}>Definição da chave</Text>
        <View style={styles.chips}>
          {DEFINICOES_CHAVE.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, definicaoChave === d.id && styles.chipOn]}
              onPress={() => setDefinicaoChave(d.id)}
            >
              <Text
                style={[styles.chipTxt, definicaoChave === d.id && styles.chipTxtOn]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          Cabeças de chave e byes são escolhidos ao liberar/refazer a chave na tela do
          torneio.
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Placar só pelo organizador</Text>
          <Switch
            value={resultadoSoOrganizador}
            onValueChange={setResultadoSoOrganizador}
            trackColor={{ false: Colors.surface, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Cobrar inscrição</Text>
          <Switch
            value={cobrar}
            onValueChange={setCobrar}
            trackColor={{ false: Colors.surface, true: Colors.accent }}
            thumbColor={Colors.white}
          />
        </View>
        {cobrar ? (
          <>
            <Input
              label="Valor (R$)"
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
            />
            <Input
              label="Prazo pagamento"
              value={prazo}
              onChangeText={(t) => setPrazo(maskDateBR(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
            />
            <Input
              label="Regras de pagamento"
              value={regrasPag}
              onChangeText={setRegrasPag}
              multiline
            />
            <Input
              label="Desconto 2ª+ categoria (R$)"
              value={descontoMultiCat}
              onChangeText={setDescontoMultiCat}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}
      </ScrollView>

      <ButtonFooter>
        <Button label="Salvar alterações" loading={saving} onPress={() => void onSalvar()} />
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
    paddingBottom: 12,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 8 },
  section: {
    color: Colors.accent,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 4,
  },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  chipTxtOn: { color: Colors.textOnAccent },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
    gap: 12,
  },
  switchLabel: { color: Colors.textPrimary, flex: 1, fontWeight: '600' },
});
