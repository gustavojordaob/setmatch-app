import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { formatMoneyBR, maskDateBR, maskMoneyBR, parseMoneyBR } from '../../utils/mascaras';
import { useAuth } from '../../hooks/useAuth';
import { liberarPagamentoAdmin } from '../../services/pagamentos';
import { usePagamentosDoDono } from '../../hooks/usePagamentos';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import {
  consultarSaldoFinanceiro,
  salvarChavePixDono,
  transferirSaldoPix,
  type SaldoFinanceiro,
} from '../../utils/asaasCheckout';
import type { PagamentoDoc } from '../../types/pagamento';
import {
  breakdownAulasPorModalidade,
  breakdownPorTipo,
  breakdownRankings,
  breakdownTorneios,
  filtrarPagamentosRelatorio,
  opcoesModalidadesAula,
  opcoesRankings,
  opcoesTorneios,
  parseDataBR,
  tipoLabel,
  totalLinha,
  valorGanho,
  type LinhaRelatorio,
  type RelatorioEscopo,
  type RelatorioPeriodo,
} from '../../utils/financeiroRelatorio';

const PIX_TIPOS = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'] as const;

const ESCOPOS: { id: RelatorioEscopo; label: string }[] = [
  { id: 'total', label: 'Total' },
  { id: 'aula', label: 'Aulas' },
  { id: 'torneio', label: 'Torneios' },
  { id: 'ranking', label: 'Rankings' },
];

const PERIODOS_ATALHO: { id: RelatorioPeriodo; label: string }[] = [
  { id: 'tudo', label: 'Tudo' },
  { id: '1m', label: '1 mês' },
  { id: '2m', label: '2 meses' },
];

function formatDateBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipOn]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function LinhasBox({ title, linhas }: { title: string; linhas: LinhaRelatorio[] }) {
  if (!linhas.length) {
    return (
      <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>{title}</Text>
        <Text style={styles.statsLine}>Sem recebimentos neste filtro.</Text>
      </View>
    );
  }
  return (
    <View style={styles.statsBox}>
      <Text style={styles.statsTitle}>{title}</Text>
      {linhas.map((l) => (
        <View key={l.key} style={{ marginTop: 6 }}>
          <Text style={styles.statsLineStrong}>
            {l.label}: {formatMoneyBR(l.recebido)} ({l.qtd}x)
          </Text>
          {l.filhos?.map((f) => (
            <Text key={`${l.key}-${f.key}`} style={styles.statsLineChild}>
              · {f.label}: {formatMoneyBR(f.recebido)} ({f.qtd}x)
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function FinanceiroClubeScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { pagamentos, loading } = usePagamentosDoDono(user?.uid);
  const [saldo, setSaldo] = useState<SaldoFinanceiro | null>(null);
  const [saldoBusy, setSaldoBusy] = useState(false);
  const [pixModal, setPixModal] = useState(false);
  const [saqueModal, setSaqueModal] = useState(false);
  const [relatorioModal, setRelatorioModal] = useState(false);
  const [pixTipo, setPixTipo] = useState<(typeof PIX_TIPOS)[number]>('CPF');
  const [pixChave, setPixChave] = useState('');
  const [saqueValor, setSaqueValor] = useState('');
  const [busy, setBusy] = useState(false);

  const [escopo, setEscopo] = useState<RelatorioEscopo>('total');
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>('tudo');
  const [dataInicioTxt, setDataInicioTxt] = useState('');
  const [dataFimTxt, setDataFimTxt] = useState('');
  const [torneioId, setTorneioId] = useState<string | null>(null);
  const [rankingId, setRankingId] = useState<string | null>(null);
  const [modalidade, setModalidade] = useState<string | null>(null);
  const [buscaNome, setBuscaNome] = useState('');

  const temDatasDigitadas =
    dataInicioTxt.length === 10 || dataFimTxt.length === 10;

  const customInicio = useMemo(() => parseDataBR(dataInicioTxt), [dataInicioTxt]);
  const customFim = useMemo(() => parseDataBR(dataFimTxt), [dataFimTxt]);

  const periodoEfetivo: RelatorioPeriodo = temDatasDigitadas ? 'custom' : periodo;

  function aplicarAtalhoPeriodo(id: RelatorioPeriodo) {
    setPeriodo(id);
    if (id === 'tudo') {
      setDataInicioTxt('');
      setDataFimTxt('');
      return;
    }
    const fim = new Date();
    const ini = new Date();
    ini.setMonth(ini.getMonth() - (id === '2m' ? 2 : 1));
    setDataInicioTxt(formatDateBR(ini));
    setDataFimTxt(formatDateBR(fim));
  }

  const filtrados = useMemo(
    () =>
      filtrarPagamentosRelatorio(pagamentos, {
        escopo,
        periodo: periodoEfetivo,
        customInicio: periodoEfetivo === 'custom' ? customInicio : null,
        customFim: periodoEfetivo === 'custom' ? customFim : null,
        torneioId: escopo === 'torneio' ? torneioId : null,
        rankingId: escopo === 'ranking' ? rankingId : null,
        modalidade: escopo === 'aula' ? modalidade : null,
        soRecebidos: true,
      }),
    [
      pagamentos,
      escopo,
      periodoEfetivo,
      customInicio,
      customFim,
      torneioId,
      rankingId,
      modalidade,
    ]
  );

  const listaFiltrada = useMemo(() => {
    const q = buscaNome.trim().toLowerCase();
    const base = filtrarPagamentosRelatorio(pagamentos, {
      escopo,
      periodo: periodoEfetivo,
      customInicio: periodoEfetivo === 'custom' ? customInicio : null,
      customFim: periodoEfetivo === 'custom' ? customFim : null,
      torneioId: escopo === 'torneio' ? torneioId : null,
      rankingId: escopo === 'ranking' ? rankingId : null,
      modalidade: escopo === 'aula' ? modalidade : null,
      soRecebidos: false,
    });
    const filtrada = q
      ? base.filter((p) => {
          const blob = [
            p.nome,
            p.setmatchId,
            p.torneioNome,
            p.rankingNome,
            p.aulaTitulo,
            p.modalidadeNome,
            p.categoriaNome,
            p.clubeNome,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return blob.includes(q);
        })
      : base;
    return [...filtrada].sort(
      (a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0)
    );
  }, [
    pagamentos,
    escopo,
    periodoEfetivo,
    customInicio,
    customFim,
    torneioId,
    rankingId,
    modalidade,
    buscaNome,
  ]);

  const total = useMemo(() => totalLinha(filtrados), [filtrados]);
  const porTipo = useMemo(() => breakdownPorTipo(filtrados), [filtrados]);
  const porAula = useMemo(() => breakdownAulasPorModalidade(filtrados), [filtrados]);
  const porTorneio = useMemo(() => breakdownTorneios(filtrados), [filtrados]);
  const porRanking = useMemo(() => breakdownRankings(filtrados), [filtrados]);

  const torneiosOpts = useMemo(() => opcoesTorneios(pagamentos), [pagamentos]);
  const rankingsOpts = useMemo(() => opcoesRankings(pagamentos), [pagamentos]);
  const modalidadesOpts = useMemo(() => opcoesModalidadesAula(pagamentos), [pagamentos]);

  const refreshSaldo = useCallback(async () => {
    if (!user) return;
    setSaldoBusy(true);
    try {
      const s = await consultarSaldoFinanceiro();
      setSaldo(s);
      if (s.pixTipo && PIX_TIPOS.includes(s.pixTipo as (typeof PIX_TIPOS)[number])) {
        setPixTipo(s.pixTipo as (typeof PIX_TIPOS)[number]);
      }
      if (s.pixChave) setPixChave(s.pixChave);
    } catch {
      setSaldo(null);
    } finally {
      setSaldoBusy(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshSaldo();
    }, [refreshSaldo])
  );

  const disponivel = Math.round((saldo?.saldoDisponivel ?? 0) * 100) / 100;
  const aLiberar = Math.round((saldo?.saldoALiberar ?? 0) * 100) / 100;
  const saldoAsaas =
    saldo?.saldoAsaasPlataforma != null
      ? Math.round(saldo.saldoAsaasPlataforma * 100) / 100
      : null;
  const asaasAbaixoDoApp =
    saldoAsaas != null && disponivel > 0 && saldoAsaas + 0.009 < disponivel;

  async function salvarPix() {
    if (!pixChave.trim()) {
      Alert.alert('PIX', 'Informe a chave.');
      return;
    }
    setBusy(true);
    try {
      await salvarChavePixDono({ pixTipo, pixChave: pixChave.trim() });
      setPixModal(false);
      await refreshSaldo();
      Alert.alert('PIX', 'Chave salva. Você pode transferir sem criar conta Asaas.');
    } catch (e: unknown) {
      Alert.alert('PIX', e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function sacar(opts?: { tudo?: boolean }) {
    const tudo = Boolean(opts?.tudo);
    const valor = tudo ? disponivel : parseMoneyBR(saqueValor);
    if (!(valor >= 1) && !tudo) {
      Alert.alert('Transferir', 'Informe um valor válido (mín. R$ 1,00).');
      return;
    }
    if (!tudo && valor > disponivel + 0.009) {
      Alert.alert(
        'Transferir',
        `Saldo insuficiente. Disponível: ${formatMoneyBR(disponivel)}`
      );
      return;
    }
    setBusy(true);
    try {
      await transferirSaldoPix({
        ...(tudo
          ? { tudo: true }
          : { valor: Math.round(Math.min(valor, disponivel) * 100) / 100 }),
        pixTipo,
        pixChave: pixChave || undefined,
      });
      setSaqueModal(false);
      setSaqueValor('');
      await refreshSaldo();
      Alert.alert('Transferência', 'Solicitação enviada via PIX. O valor sai da conta Rally Up.');
    } catch (e: unknown) {
      Alert.alert('Transferir', e instanceof Error ? e.message : 'Falha na transferência');
      await refreshSaldo();
    } finally {
      setBusy(false);
    }
  }

  async function liberar(p: PagamentoDoc) {
    Alert.alert('Liberar acesso', `Liberar ${p.nome} sem esperar o pagamento?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Liberar',
        onPress: () =>
          void liberarPagamentoAdmin(p.id)
            .then(() => refreshSaldo())
            .catch((e: unknown) =>
              Alert.alert('Erro', e instanceof Error ? e.message : 'Falha')
            ),
      },
    ]);
  }

  async function msg(p: PagamentoDoc) {
    if (!user || !perfil) return;
    const id = await abrirOuCriarConversaAmigo({
      uidA: user.uid,
      nomeA: perfil.nome,
      fotoA: perfil.fotoUrl,
      uidB: p.uid,
      nomeB: p.nome,
    });
    await enviarMensagem({
      conversaId: id,
      deUid: user.uid,
      deNome: perfil.nome,
      texto: `Sobre seu pagamento (${p.tipo}): status ${p.status}. Qualquer dúvida, fale comigo.`,
    });
    router.push(`/chat/${id}`);
  }

  const header = (
    <View style={{ gap: 10, marginBottom: 8 }}>
      <View style={styles.saldoCard}>
        <Text style={styles.saldoLabel}>Pode sacar agora (líquido)</Text>
        {saldoBusy && !saldo ? (
          <ActivityIndicator color={Colors.textOnAccent} />
        ) : (
          <Text style={styles.saldoValor}>{formatMoneyBR(disponivel)}</Text>
        )}
        {aLiberar > 0.009 ? (
          <Text style={styles.asaasWarn}>
            A liberar (cartão): {formatMoneyBR(aLiberar)} — com antecipação costuma cair em até
            1–2 dias úteis. Esse valor ainda não pode ser transferido.
          </Text>
        ) : null}
        <Text style={styles.saldoMeta}>
          Valores já com taxa Asaas descontada
          {aLiberar > 0.009 ? ' (cartão inclui antecipação)' : ''} · Total recebido{' '}
          {formatMoneyBR(saldo?.saldoTotalRecebido ?? 0)} · Transferido{' '}
          {formatMoneyBR(saldo?.saldoTransferido ?? 0)}
        </Text>
        {asaasAbaixoDoApp ? (
          <Text style={styles.asaasWarn}>
            Caixa Asaas liberado agora: {formatMoneyBR(saldoAsaas ?? 0)}. Se for menor que o seu
            saldo, aguarde a liquidação do cartão.
          </Text>
        ) : null}
        <View style={styles.saldoActions}>
          <TouchableOpacity style={styles.saldoBtn} onPress={() => setPixModal(true)}>
            <Text style={styles.saldoBtnText}>
              {saldo?.pixChave ? 'Alterar PIX' : 'Cadastrar PIX'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saldoBtn, styles.saldoBtnPrimary]}
            onPress={() => setSaqueModal(true)}
            disabled={disponivel < 1}
          >
            <Text style={styles.saldoBtnTextDark}>Transferir</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.saldoBtn, { marginTop: 8 }]}
          onPress={() => setRelatorioModal(true)}
        >
          <Text style={styles.saldoBtnText}>Ver relatório completo</Text>
        </TouchableOpacity>
        {saldo?.pixChave ? (
          <Text style={styles.pixHint}>
            PIX {saldo.pixTipo}: {saldo.pixChave}
          </Text>
        ) : (
          <Text style={styles.pixHint}>Cadastre uma chave PIX para sacar sem conta Asaas.</Text>
        )}
      </View>

      <Text style={styles.filterLabel}>Tipo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ESCOPOS.map((e) => (
          <Chip
            key={e.id}
            label={e.label}
            active={escopo === e.id}
            onPress={() => {
              setEscopo(e.id);
              if (e.id !== 'torneio' && e.id !== 'total') setTorneioId(null);
              if (e.id !== 'ranking' && e.id !== 'total') setRankingId(null);
              if (e.id !== 'aula') setModalidade(null);
            }}
          />
        ))}
      </ScrollView>

      <Text style={styles.filterLabel}>Período (digite a data)</Text>
      <Text style={styles.dateHint}>Formato DD/MM/AAAA — ex.: 01/08/2026</Text>
      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateFieldLabel}>De</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.textSecondary}
            value={dataInicioTxt}
            onChangeText={(t) => {
              setDataInicioTxt(maskDateBR(t));
              setPeriodo('custom');
            }}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateFieldLabel}>Até</Text>
          <TextInput
            style={styles.input}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={Colors.textSecondary}
            value={dataFimTxt}
            onChangeText={(t) => {
              setDataFimTxt(maskDateBR(t));
              setPeriodo('custom');
            }}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {PERIODOS_ATALHO.map((p) => (
          <Chip
            key={p.id}
            label={p.label}
            active={!temDatasDigitadas ? periodo === p.id : false}
            onPress={() => aplicarAtalhoPeriodo(p.id)}
          />
        ))}
      </ScrollView>
      {temDatasDigitadas && (!customInicio && dataInicioTxt.length === 10) ? (
        <Text style={styles.dateWarn}>Data inicial inválida.</Text>
      ) : null}
      {temDatasDigitadas && (!customFim && dataFimTxt.length === 10) ? (
        <Text style={styles.dateWarn}>Data final inválida.</Text>
      ) : null}

      {escopo === 'torneio' && torneiosOpts.length > 0 ? (
        <>
          <Text style={styles.filterLabel}>Torneio</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="Todos" active={!torneioId} onPress={() => setTorneioId(null)} />
            {torneiosOpts.map((t) => (
              <Chip
                key={t.id}
                label={t.nome}
                active={torneioId === t.id}
                onPress={() => setTorneioId(t.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {escopo === 'ranking' && rankingsOpts.length > 0 ? (
        <>
          <Text style={styles.filterLabel}>Ranking</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="Todos" active={!rankingId} onPress={() => setRankingId(null)} />
            {rankingsOpts.map((r) => (
              <Chip
                key={r.id}
                label={r.nome}
                active={rankingId === r.id}
                onPress={() => setRankingId(r.id)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {escopo === 'aula' && modalidadesOpts.length > 0 ? (
        <>
          <Text style={styles.filterLabel}>Modalidade (aula)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="Todas" active={!modalidade} onPress={() => setModalidade(null)} />
            {modalidadesOpts.map((m) => (
              <Chip
                key={m}
                label={m}
                active={modalidade === m}
                onPress={() => setModalidade(m)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.statsBox}>
        <Text style={styles.statsTitle}>Resumo do filtro</Text>
        <Text style={styles.statsLineStrong}>
          {total.label}: {formatMoneyBR(total.recebido)} ({total.qtd} pagamentos)
        </Text>
      </View>

      {escopo === 'total' ? <LinhasBox title="Por tipo" linhas={porTipo} /> : null}
      {(escopo === 'aula' || escopo === 'total') && porAula.length > 0 ? (
        <LinhasBox title="Aulas por modalidade" linhas={porAula} />
      ) : null}
      {(escopo === 'torneio' || escopo === 'total') && porTorneio.length > 0 ? (
        <LinhasBox title="Torneios (categoria · modalidade)" linhas={porTorneio} />
      ) : null}
      {(escopo === 'ranking' || escopo === 'total') && porRanking.length > 0 ? (
        <LinhasBox title="Rankings" linhas={porRanking} />
      ) : null}

      <Text style={styles.listTitle}>Pagamentos</Text>
      <TextInput
        style={styles.input}
        placeholder="Buscar por nome, torneio, ranking…"
        placeholderTextColor={Colors.textSecondary}
        value={buscaNome}
        onChangeText={setBuscaNome}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Financeiro</Text>
        <TouchableOpacity onPress={() => void refreshSaldo()}>
          <Ionicons name="refresh" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>
        Pode sacar = liberado na Asaas · cartão com antecipação em até 1–2 dias úteis · taxas
        visíveis em cada pagamento
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={listaFiltrada}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum pagamento neste filtro.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>
                  {item.nome} · {item.setmatchId}
                </Text>
                <Text style={styles.meta}>
                  {tipoLabel(item.tipo)}
                  {item.meioPagamento === 'pix'
                    ? ' · PIX'
                    : item.meioPagamento === 'cartao'
                      ? ' · Cartão'
                      : ''}{' '}
                  · {item.ciclo}
                </Text>
                <Text style={styles.meta}>
                  Bruto {formatMoneyBR(Number(item.valorBruto ?? item.valor))}
                  {item.taxaAsaas != null && item.taxaAsaas > 0
                    ? ` − taxa ${formatMoneyBR(item.taxaAsaas)}`
                    : ''}
                  {' = '}
                  líquido {formatMoneyBR(valorGanho(item))}
                </Text>
                {item.meioPagamento === 'cartao' ? (
                  <Text style={styles.meta}>
                    {item.liberadoParaSaque === false
                      ? `A liberar para saque${
                          item.estimatedCreditDate
                            ? ` · previsto ${item.estimatedCreditDate}`
                            : ' · até 1–2 dias úteis'
                        }`
                      : item.anticipated
                        ? 'Cartão antecipado · já pode sacar'
                        : 'Liberado para saque'}
                  </Text>
                ) : item.liberadoParaSaque === false ? (
                  <Text style={styles.meta}>A liberar para saque</Text>
                ) : null}
                <Text style={styles.status}>{item.status}</Text>
                {item.aulaTitulo ||
                item.torneioNome ||
                item.rankingNome ||
                item.categoriaNome ||
                item.modalidadeNome ? (
                  <Text style={styles.meta}>
                    {[
                      item.torneioNome || item.rankingNome || item.aulaTitulo,
                      item.categoriaNome,
                      item.modalidadeNome && item.modalidadeNome !== item.aulaTitulo
                        ? item.modalidadeNome
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => void msg(item)}>
                  <Ionicons name="chatbubble-ellipses" size={22} color={Colors.accent} />
                </TouchableOpacity>
                {item.status !== 'aprovado' && item.status !== 'liberado_admin' ? (
                  <TouchableOpacity onPress={() => liberar(item)}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={relatorioModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Relatório</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.statsLineStrong}>
                Total: {formatMoneyBR(total.recebido)} ({total.qtd}x)
              </Text>
              <Text style={[styles.statsTitle, { marginTop: 12 }]}>Por tipo</Text>
              {porTipo.map((l) => (
                <Text key={l.key} style={styles.statsLine}>
                  {l.label}: {formatMoneyBR(l.recebido)} ({l.qtd}x)
                </Text>
              ))}
              <Text style={[styles.statsTitle, { marginTop: 12 }]}>Aulas / modalidade</Text>
              {porAula.length === 0 ? (
                <Text style={styles.statsLine}>—</Text>
              ) : (
                porAula.map((l) => (
                  <Text key={l.key} style={styles.statsLine}>
                    {l.label}: {formatMoneyBR(l.recebido)} ({l.qtd}x)
                  </Text>
                ))
              )}
              <Text style={[styles.statsTitle, { marginTop: 12 }]}>Torneios</Text>
              {porTorneio.length === 0 ? (
                <Text style={styles.statsLine}>—</Text>
              ) : (
                porTorneio.map((l) => (
                  <View key={l.key} style={{ marginTop: 4 }}>
                    <Text style={styles.statsLineStrong}>
                      {l.label}: {formatMoneyBR(l.recebido)} ({l.qtd}x)
                    </Text>
                    {l.filhos?.map((f) => (
                      <Text key={`${l.key}-${f.key}`} style={styles.statsLineChild}>
                        · {f.label}: {formatMoneyBR(f.recebido)} ({f.qtd}x)
                      </Text>
                    ))}
                  </View>
                ))
              )}
              <Text style={[styles.statsTitle, { marginTop: 12 }]}>Rankings</Text>
              {porRanking.length === 0 ? (
                <Text style={styles.statsLine}>—</Text>
              ) : (
                porRanking.map((l) => (
                  <View key={l.key} style={{ marginTop: 4 }}>
                    <Text style={styles.statsLineStrong}>
                      {l.label}: {formatMoneyBR(l.recebido)} ({l.qtd}x)
                    </Text>
                    {l.filhos?.map((f) => (
                      <Text key={`${l.key}-${f.key}`} style={styles.statsLineChild}>
                        · {f.label}: {formatMoneyBR(f.recebido)} ({f.qtd}x)
                      </Text>
                    ))}
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity onPress={() => setRelatorioModal(false)}>
              <Text style={styles.cancel}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={pixModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setPixModal(false)}
          />
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              <Text style={styles.modalTitle}>Chave PIX</Text>
              <View style={styles.tipoRow}>
                {PIX_TIPOS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tipoChip, pixTipo === t && styles.tipoChipOn]}
                    onPress={() => setPixTipo(t)}
                  >
                    <Text style={[styles.tipoChipText, pixTipo === t && styles.tipoChipTextOn]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.input}
                placeholder="Sua chave PIX"
                placeholderTextColor={Colors.textSecondary}
                value={pixChave}
                onChangeText={setPixChave}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.cta} onPress={() => void salvarPix()} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color={Colors.textOnAccent} />
                ) : (
                  <Text style={styles.ctaText}>Salvar</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPixModal(false)}>
                <Text style={styles.cancel}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={saqueModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSaqueModal(false)}
          />
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            >
              <Text style={styles.modalTitle}>Transferir via PIX</Text>
              <Text style={styles.statsLine}>
                Disponível no app: {formatMoneyBR(disponivel)}
                {saldoAsaas != null
                  ? ` · Liberado Asaas: ${formatMoneyBR(saldoAsaas)}`
                  : ''}
              </Text>
              {asaasAbaixoDoApp ? (
                <Text style={styles.asaasWarnDark}>
                  Parte do saldo ainda não está liberada na Asaas para PIX (comum em cartão).
                </Text>
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="Valor (ex: 50,00)"
                placeholderTextColor={Colors.textSecondary}
                value={saqueValor}
                onChangeText={(t) => setSaqueValor(maskMoneyBR(t))}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={styles.saqueTudoBtn}
                onPress={() => void sacar({ tudo: true })}
                disabled={busy || disponivel < 1}
              >
                <Text style={styles.saqueTudoText}>
                  Transferir tudo ({formatMoneyBR(disponivel)})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cta}
                onPress={() => void sacar()}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={Colors.textOnAccent} />
                ) : (
                  <Text style={styles.ctaText}>Confirmar transferência</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSaqueModal(false)}>
                <Text style={styles.cancel}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  sub: {
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
  },
  saldoCard: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
  },
  saldoLabel: { color: Colors.textOnAccent, opacity: 0.85, fontSize: 12 },
  saldoValor: {
    color: Colors.textOnAccent,
    fontWeight: '800',
    fontSize: 28,
    marginTop: 4,
  },
  saldoMeta: { color: Colors.textOnAccent, opacity: 0.8, fontSize: 11, marginTop: 4 },
  saldoActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  saldoBtn: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 60,
    paddingVertical: 10,
    alignItems: 'center',
  },
  saldoBtnPrimary: { backgroundColor: Colors.surfaceDark },
  saldoBtnText: { color: Colors.textOnAccent, fontWeight: '700', fontSize: 13 },
  saldoBtnTextDark: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  pixHint: { color: Colors.textOnAccent, opacity: 0.75, fontSize: 11, marginTop: 8 },
  asaasWarn: {
    color: Colors.textOnAccent,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    opacity: 0.95,
  },
  asaasWarnDark: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  filterLabel: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 12,
    marginTop: 4,
  },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    maxWidth: 200,
  },
  chipOn: { backgroundColor: Colors.accent },
  chipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: Colors.textOnAccent },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateHint: { color: Colors.textSecondary, fontSize: 11, marginTop: -4 },
  dateFieldLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  dateWarn: { color: Colors.danger, fontSize: 11 },
  statsBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  statsTitle: { color: Colors.accent, fontWeight: '700', fontSize: 13 },
  statsLine: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  statsLineStrong: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  statsLineChild: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    marginLeft: 6,
  },
  listTitle: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 15,
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  status: { color: Colors.accent, fontWeight: '700', marginTop: 4, fontSize: 12 },
  actions: { gap: 12, justifyContent: 'center' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surfaceDark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  modalTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tipoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 60,
    backgroundColor: Colors.surface,
  },
  tipoChipOn: { backgroundColor: Colors.accent },
  tipoChipText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  tipoChipTextOn: { color: Colors.textOnAccent },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  saqueTudoBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 60,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saqueTudoText: { color: Colors.accent, fontWeight: '700', fontSize: 14 },
  cta: {
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 15 },
  cancel: { color: Colors.textSecondary, textAlign: 'center', padding: 8 },
});
