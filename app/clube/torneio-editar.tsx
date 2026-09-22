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
import {
  EnderecoLocalForm,
  type EnderecoFormValue,
} from '../../components/torneio/EnderecoLocalForm';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../utils/firebaseConfig';
import {
  atualizarDadosTorneio,
} from '../../services/torneios';
import {
  DEFINICOES_CHAVE,
  ESTRUTURAS_MATA,
  FORMATOS_PARTIDA_TORNEIO,
  type DefinicaoChaveId,
  type EstruturaMataId,
  type FormatoPartidaTorneioId,
} from '../../constants/chaveamentosTorneio';
import { maskDateBR, maskTimeHHMM, maskMoneyBR, parseMoneyBR, toMoneyInputBR } from '../../utils/mascaras';
import { INTERVALOS_JOGO_OPCOES, parseListaQuadras } from '../../utils/agendaTorneio';
import {
  labelComposicao,
  type ComposicaoId,
} from '../../constants/composicao';
import {
  buscarEnderecoPorCep,
  cepCompleto,
  formatarCepDigitando,
} from '../../utils/viacep';

export default function TorneioEditarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [enderecoForm, setEnderecoForm] = useState<EnderecoFormValue>({
    localNome: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
  });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [horarioPadrao, setHorarioPadrao] = useState('');
  const [quadraNome, setQuadraNome] = useState('');
  const [intervaloJogosMin, setIntervaloJogosMin] = useState(60);
  const [quadrasTexto, setQuadrasTexto] = useState('');
  const [atribuirQuadrasAoSortear, setAtribuirQuadrasAoSortear] = useState(false);
  const [resultadoSoOrganizador, setResultadoSoOrganizador] = useState(false);
  const [cobrar, setCobrar] = useState(false);
  const [valor, setValor] = useState(toMoneyInputBR(0));
  const [regrasPag, setRegrasPag] = useState('');
  const [prazo, setPrazo] = useState('');
  const [descontoMultiCat, setDescontoMultiCat] = useState(toMoneyInputBR(0));
  const [composicao, setComposicao] = useState<ComposicaoId>('simples');
  const [formatoPartidaId, setFormatoPartidaId] =
    useState<FormatoPartidaTorneioId>('melhor_de_3_stb');
  const [estruturaMata, setEstruturaMata] = useState<EstruturaMataId>(8);
  const [definicaoChave, setDefinicaoChave] = useState<DefinicaoChaveId>('sorteio');

  async function onCepChange(raw: string) {
    const masked = formatarCepDigitando(raw);
    setEnderecoForm((prev) => ({ ...prev, cep: masked }));
    if (!cepCompleto(masked)) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(masked);
      if (!end) {
        Alert.alert('CEP', 'CEP não encontrado. Complete o endereço manualmente.');
        return;
      }
      setEnderecoForm((prev) => ({
        ...prev,
        cep: masked,
        cidade: end.localidade,
        estado: end.uf,
        bairro: end.bairro || prev.bairro,
        endereco: end.logradouro || prev.endereco,
      }));
    } finally {
      setBuscandoCep(false);
    }
  }
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
        setEnderecoForm({
          localNome: String(raw.local ?? ''),
          cep: String(raw.cep ?? ''),
          endereco: String(raw.endereco ?? ''),
          bairro: String(raw.bairro ?? ''),
          cidade: String(raw.cidade ?? ''),
          estado: String(raw.estado ?? ''),
        });
        setDescricao(String(raw.descricao ?? ''));
        setHorarioPadrao(String(raw.horarioPadrao ?? ''));
        setQuadraNome(String(raw.quadraNome ?? ''));
        setIntervaloJogosMin(Number(raw.intervaloJogosMin) || 60);
        setQuadrasTexto(
          Array.isArray(raw.quadrasDisponiveis)
            ? (raw.quadrasDisponiveis as unknown[])
                .map((q) => String(q ?? '').trim())
                .filter(Boolean)
                .join('\n')
            : ''
        );
        setAtribuirQuadrasAoSortear(Boolean(raw.atribuirQuadrasAoSortear));
        setResultadoSoOrganizador(Boolean(raw.resultadoSoOrganizador));
        setComposicao((raw.composicao as ComposicaoId) || 'simples');
        setFormatoPartidaId(
          (raw.formatoPartidaId as FormatoPartidaTorneioId) || 'melhor_de_3_stb'
        );
        setEstruturaMata((Number(raw.estruturaMata) as EstruturaMataId) || 8);
        setDefinicaoChave((raw.definicaoChave as DefinicaoChaveId) || 'sorteio');
        const pag = raw.pagamento as Torneio['pagamento'] | undefined;
        setCobrar(Boolean(pag?.ativo));
        setValor(toMoneyInputBR(Number(pag?.valor ?? 0)));
        setRegrasPag(String(pag?.regras ?? ''));
        setPrazo(String(pag?.prazoPagamento ?? ''));
        setDescontoMultiCat(toMoneyInputBR(Number(pag?.descontoMultiCategoriaValor ?? 0)));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, router]);

  async function onSalvar() {
    if (!id) return;
    if (!enderecoForm.localNome.trim()) {
      Alert.alert('Torneio', 'Informe o nome do clube / local.');
      return;
    }
    if (!cepCompleto(enderecoForm.cep)) {
      Alert.alert('Torneio', 'Informe um CEP válido.');
      return;
    }
    if (
      !enderecoForm.cidade.trim() ||
      !enderecoForm.estado.trim() ||
      !enderecoForm.endereco.trim() ||
      !enderecoForm.bairro.trim()
    ) {
      Alert.alert('Torneio', 'Complete o endereço (rua, bairro, cidade e UF).');
      return;
    }
    setSaving(true);
    try {
      const valorNum = parseMoneyBR(valor);
      await atualizarDadosTorneio(id, {
        nome,
        dataInicio,
        dataFim,
        local: enderecoForm.localNome.trim(),
        cep: enderecoForm.cep.trim(),
        endereco: enderecoForm.endereco.trim(),
        bairro: enderecoForm.bairro.trim(),
        cidade: enderecoForm.cidade.trim(),
        estado: enderecoForm.estado.trim().toUpperCase(),
        descricao,
        horarioPadrao,
        quadraNome,
        intervaloJogosMin,
        quadrasDisponiveis: parseListaQuadras(quadrasTexto),
        atribuirQuadrasAoSortear,
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
          descontoMultiCategoriaValor: parseMoneyBR(descontoMultiCat),
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
        <EnderecoLocalForm
          value={enderecoForm}
          onChange={setEnderecoForm}
          buscandoCep={buscandoCep}
          onCepChange={(t) => void onCepChange(t)}
        />
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
        <Input label="Quadra ref. (opcional)" value={quadraNome} onChangeText={setQuadraNome} />
        <Text style={styles.section}>Espaçamento entre jogos</Text>
        <Text style={styles.hint}>
          No sorteio e na redistribuição da agenda (1h, 2h…).
        </Text>
        <View style={styles.chips}>
          {INTERVALOS_JOGO_OPCOES.map((op) => (
            <TouchableOpacity
              key={op.min}
              style={[styles.chip, intervaloJogosMin === op.min && styles.chipOn]}
              onPress={() => setIntervaloJogosMin(op.min)}
            >
              <Text
                style={[styles.chipTxt, intervaloJogosMin === op.min && styles.chipTxtOn]}
              >
                {op.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Sortear quadras nos jogos</Text>
          <Switch
            value={atribuirQuadrasAoSortear}
            onValueChange={setAtribuirQuadrasAoSortear}
            trackColor={{ true: Colors.accent, false: Colors.surface }}
          />
        </View>
        <Text style={styles.hint}>
          Desligado = sem quadra até você preencher na hora. Ligado = distribui a lista
          abaixo ao sortear.
        </Text>
        {atribuirQuadrasAoSortear ? (
          <Input
            label="Quadras (uma por linha)"
            value={quadrasTexto}
            onChangeText={setQuadrasTexto}
            placeholder={'Quadra 1\nQuadra 2'}
            multiline
          />
        ) : null}

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

        <Text style={styles.section}>Fase inicial da chave</Text>
        <Text style={styles.hint}>
          Ex.: Semifinal (4) = começa nas semis (até 4 vagas na chave).
        </Text>
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
              onChangeText={(t) => setValor(maskMoneyBR(t))}
              keyboardType="number-pad"
              placeholder="0,00"
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
              onChangeText={(t) => setDescontoMultiCat(maskMoneyBR(t))}
              keyboardType="number-pad"
              placeholder="0,00"
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
