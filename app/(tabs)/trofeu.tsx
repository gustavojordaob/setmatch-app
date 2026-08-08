import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { RankingConnectedCard } from '../../components/ranking/RankingConnectedCard';
import {
  useMinhasSolicitacoes,
  useRankings,
  useSolicitacoesRecebidas,
} from '../../hooks/useRankings';
import {
  aceitarSolicitacao,
  recusarSolicitacao,
  solicitarEntrada,
} from '../../services/rankings';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../services/mensagens';
import { registrarInteresseAulas } from '../../services/torneios';
import { criarRegistroPagamento, solicitarAulas } from '../../services/pagamentos';
import { iniciarCheckoutMercadoPago } from '../../utils/mercadoPago';
import { useTorneios } from '../../hooks/useTorneios';
import { useAuth } from '../../hooks/useAuth';
import { useEsporte } from '../../contexts/EsporteContext';
import { EsporteSwitcher } from '../../components/EsporteSwitcher';
import { ClubeSwitcher } from '../../components/ClubeSwitcher';
import { useClube } from '../../contexts/ClubeContext';
import { ESPORTES } from '../../constants/esportes';
import { db } from '../../utils/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Ranking, Solicitacao } from '../../types/ranking';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;
type Aba = 'rankings' | 'torneios';

export default function TrofeuScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { esporteAtivo } = useEsporte();
  const { clubeAtivo, clubeAtivoId } = useClube();
  const { meus, proximos, loading } = useRankings();
  const { torneios, loading: loadingTorneios } = useTorneios(esporteAtivo);
  const minhasSol = useMinhasSolicitacoes();
  const recebidas = useSolicitacoesRecebidas();
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('rankings');

  const esporteNome = ESPORTES.find((e) => e.id === esporteAtivo)?.nome ?? 'Esporte';
  const minhaCidade = (perfil?.cidade ?? '').toLowerCase();

  const statusPorRanking = useMemo(() => {
    const map = new Map<string, string>();
    minhasSol.forEach((s) => map.set(s.rankingId, s.status));
    return map;
  }, [minhasSol]);

  const meusEsporte = useMemo(
    () =>
      meus.filter(
        (r) =>
          r.esporte === esporteAtivo &&
          (!clubeAtivoId || r.clubeId === clubeAtivoId)
      ),
    [meus, esporteAtivo, clubeAtivoId]
  );

  const proximosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return proximos.filter((r) => {
      if (r.esporte !== esporteAtivo) return false;
      if (clubeAtivoId && r.clubeId !== clubeAtivoId) return false;
      if (t) {
        return (
          r.nome.toLowerCase().includes(t) ||
          r.clubeNome.toLowerCase().includes(t) ||
          r.cidade.toLowerCase().includes(t)
        );
      }
      if (minhaCidade) return r.cidade.toLowerCase().includes(minhaCidade);
      return true;
    });
  }, [busca, proximos, esporteAtivo, minhaCidade, clubeAtivoId]);

  const torneiosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return torneios.filter((tr) => {
      if (clubeAtivoId && tr.clubeId !== clubeAtivoId) return false;
      if (t) {
        return (
          tr.nome.toLowerCase().includes(t) ||
          tr.clubeNome.toLowerCase().includes(t) ||
          tr.cidade.toLowerCase().includes(t)
        );
      }
      if (minhaCidade) return tr.cidade.toLowerCase().includes(minhaCidade);
      return true;
    });
  }, [torneios, busca, minhaCidade, clubeAtivoId]);

  async function handleSolicitar(r: Ranking) {
    if (!user || !perfil) return;
    setEnviando(r.id);
    try {
      await solicitarEntrada({
        rankingId: r.id,
        rankingNome: r.nome,
        clubeId: r.clubeId,
        clubeNome: r.clubeNome,
        donoUid: r.donoUid,
        uid: user.uid,
        nome: perfil.nome,
        fotoUrl: perfil.fotoUrl,
      });
      const conversaId = await abrirOuCriarConversaClube({
        uid: user.uid,
        nome: perfil.nome,
        clubeId: r.clubeId,
        clubeNome: r.clubeNome,
        donoUid: r.donoUid,
      });
      await enviarMensagem({
        conversaId,
        deUid: user.uid,
        deNome: perfil.nome,
        texto:
          `Olá! Solicitei entrada no ranking "${r.nome}". ` +
          `ID: ${perfil.setmatchId || '—'}. WhatsApp: ${perfil.telefone || 'não informado'}.`,
      });

      if (r.pagamento?.ativo && r.pagamento.exigeParaEntrar && r.pagamento.valor > 0) {
        const pagamentoId = await criarRegistroPagamento({
          uid: user.uid,
          setmatchId: perfil.setmatchId || '',
          nome: perfil.nome,
          telefone: perfil.telefone,
          tipo: 'ranking',
          clubeId: r.clubeId,
          clubeNome: r.clubeNome,
          donoUid: r.donoUid,
          rankingId: r.id,
          rankingNome: r.nome,
          valor: r.pagamento.valor,
          ciclo: r.pagamento.ciclo,
          status: 'aguardando_pagamento',
        });
        Alert.alert(
          'Solicitação + pagamento',
          `Taxa R$ ${r.pagamento.valor.toFixed(2)} (${r.pagamento.ciclo}). ${r.pagamento.regras || ''}`,
          [
            {
              text: 'Pagar agora',
              onPress: () =>
                void iniciarCheckoutMercadoPago({
                  pagamentoId,
                  titulo: `Ranking · ${r.nome}`,
                  valor: r.pagamento!.valor,
                  ciclo: r.pagamento!.ciclo,
                  permitePix: r.pagamento!.permitePix,
                  permiteCartao: r.pagamento!.permiteCartao,
                }),
            },
            { text: 'Meus pagamentos', onPress: () => router.push('/pagamentos') },
            { text: 'Chat', onPress: () => router.push(`/chat/${conversaId}`) },
          ]
        );
      } else {
        Alert.alert(
          'Solicitação enviada',
          'O dono do clube recebeu o pedido e uma mensagem no chat.',
          [
            { text: 'Abrir chat', onPress: () => router.push(`/chat/${conversaId}`) },
            { text: 'OK' },
          ]
        );
      }
    } finally {
      setEnviando(null);
    }
  }

  async function handleAulas(r: Ranking) {
    if (!user || !perfil) return;
    setEnviando(`aula-${r.id}`);
    try {
      await registrarInteresseAulas({
        uid: user.uid,
        nome: perfil.nome,
        telefone: perfil.telefone,
        clubeId: r.clubeId,
        clubeNome: r.clubeNome,
        donoUid: r.donoUid,
        esporte: r.esporte,
      });
      await solicitarAulas({
        clubeId: r.clubeId,
        clubeNome: r.clubeNome,
        donoUid: r.donoUid,
        uid: user.uid,
        setmatchId: perfil.setmatchId || '',
        nome: perfil.nome,
        telefone: perfil.telefone,
      });

      const conversaId = await abrirOuCriarConversaClube({
        uid: user.uid,
        nome: perfil.nome,
        clubeId: r.clubeId,
        clubeNome: r.clubeNome,
        donoUid: r.donoUid,
      });
      await enviarMensagem({
        conversaId,
        deUid: user.uid,
        deNome: perfil.nome,
        texto:
          `Tenho interesse em aulas de ${esporteNome} no ${r.clubeNome}. ` +
          `Meu ID: ${perfil.setmatchId || '—'}. WhatsApp: ${perfil.telefone || '—'}.`,
      });

      const clubeSnap = await getDoc(doc(db, 'clubes', r.clubeId));
      const aulas = clubeSnap.exists()
        ? (clubeSnap.data().aulas as
            | { ativo?: boolean; valorMensal?: number; permitePix?: boolean; permiteCartao?: boolean }
            | undefined)
        : undefined;

      if (aulas?.ativo && (aulas.valorMensal ?? 0) > 0) {
        const pagamentoId = await criarRegistroPagamento({
          uid: user.uid,
          setmatchId: perfil.setmatchId || '',
          nome: perfil.nome,
          telefone: perfil.telefone,
          tipo: 'aula',
          clubeId: r.clubeId,
          clubeNome: r.clubeNome,
          donoUid: r.donoUid,
          valor: Number(aulas.valorMensal),
          ciclo: 'mensal',
          status: 'aguardando_pagamento',
        });
        Alert.alert(
          'Aulas',
          `Mensalidade R$ ${Number(aulas.valorMensal).toFixed(2)}. O admin também pode liberar no painel.`,
          [
            {
              text: 'Pagar agora',
              onPress: () =>
                void iniciarCheckoutMercadoPago({
                  pagamentoId,
                  titulo: `Aulas · ${r.clubeNome}`,
                  valor: Number(aulas.valorMensal),
                  ciclo: 'mensal',
                  permitePix: aulas.permitePix ?? true,
                  permiteCartao: aulas.permiteCartao ?? true,
                }),
            },
            { text: 'Meus pagamentos', onPress: () => router.push('/pagamentos') },
            { text: 'Chat', onPress: () => router.push(`/chat/${conversaId}`) },
          ]
        );
      } else {
        Alert.alert(
          'Interesse registrado',
          'O admin vai explicar valores e liberar sua matrícula.',
          [
            { text: 'Abrir chat', onPress: () => router.push(`/chat/${conversaId}`) },
            { text: 'OK' },
          ]
        );
      }
    } finally {
      setEnviando(null);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Voltar">
            <Ionicons name="arrow-back" size={26} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push('/(tabs)/notificacoes')}
            accessibilityLabel="Notificações"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.white} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: TAB_PAD_BOTTOM }]}>
          <View style={styles.titleRow}>
            <Ionicons name="trophy" size={36} color={Colors.accent} />
            <Text style={styles.title}>CLUBES</Text>
          </View>
          <EsporteSwitcher variant="chips" />
          <ClubeSwitcher />
          <Text style={styles.esporteHint}>
            Só {esporteNome}
            {minhaCidade ? ` · perto de ${perfil?.cidade}` : ''}
            {clubeAtivo ? ` · ${clubeAtivo.nome}` : ''}
          </Text>
          <Text style={styles.esporteHint2}>
            Escolha esporte e clube no topo. Rankings e torneios seguem o filtro.
          </Text>
          <TouchableOpacity
            style={styles.meusClubesBtn}
            onPress={() => router.push('/meus-clubes')}
          >
            <Ionicons name="business-outline" size={18} color={Colors.textOnAccent} />
            <Text style={styles.meusClubesTxt}>Meus clubes (aulas · rankings · pagamentos)</Text>
          </TouchableOpacity>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, aba === 'rankings' && styles.tabOn]}
              onPress={() => setAba('rankings')}
            >
              <Text style={[styles.tabTxt, aba === 'rankings' && styles.tabTxtOn]}>Rankings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, aba === 'torneios' && styles.tabOn]}
              onPress={() => setAba('torneios')}
            >
              <Text style={[styles.tabTxt, aba === 'torneios' && styles.tabTxtOn]}>Torneios</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar clube, cidade…"
              placeholderTextColor={Colors.textSecondary}
              value={busca}
              onChangeText={setBusca}
            />
          </View>

          {aba === 'rankings' ? (
            <>
              {recebidas.length > 0 ? (
                <View style={styles.solBox}>
                  <Text style={styles.solTitle}>Solicitações recebidas</Text>
                  {recebidas.map((s) => (
                    <SolicitacaoRow key={s.id} sol={s} />
                  ))}
                </View>
              ) : null}

              {loading ? (
                <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
              ) : (
                <>
                  {meusEsporte.length > 0 ? (
                    <>
                      <Text style={styles.section}>Meus rankings · {esporteNome}</Text>
                      {meusEsporte.map((r) => (
                        <View key={r.id} style={{ marginBottom: 8 }}>
                          <RankingConnectedCard
                            ranking={r}
                            pinned
                            onVerMais={() => router.push(`/ranking/${r.id}`)}
                          />
                          <TouchableOpacity
                            style={styles.verClubeLink}
                            onPress={() => router.push(`/meu-clube/${r.clubeId}`)}
                          >
                            <Text style={styles.verClubeTxt}>Ver clube · aulas e pagamentos</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </>
                  ) : null}

                  <Text style={styles.section}>Rankings próximos · {esporteNome}</Text>
                  {proximosFiltrados.length === 0 ? (
                    <Text style={styles.empty}>Nenhum ranking encontrado.</Text>
                  ) : (
                    proximosFiltrados.map((r) => {
                      const status = statusPorRanking.get(r.id);
                      return (
                        <View key={r.id} style={styles.clubeCard}>
                          <TouchableOpacity
                            style={styles.clubeInfo}
                            onPress={() => router.push(`/ranking/${r.id}`)}
                          >
                            <Text style={styles.clubeNome}>{r.nome}</Text>
                            <Text style={styles.clubeMeta}>
                              {r.clubeNome} · {r.cidade}
                            </Text>
                            <Text style={styles.clubeMembros}>
                              {r.totalMembros}{' '}
                              {r.totalMembros === 1 ? 'jogador' : 'jogadores'}
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.actionsCol}>
                            <TouchableOpacity
                              style={[
                                styles.solicitarBtn,
                                status === 'pendente' && styles.pendenteBtn,
                              ]}
                              disabled={status === 'pendente' || enviando === r.id}
                              onPress={() => void handleSolicitar(r)}
                            >
                              {enviando === r.id ? (
                                <ActivityIndicator color={Colors.textOnAccent} size="small" />
                              ) : (
                                <Text style={styles.solicitarTxt}>
                                  {status === 'pendente' ? 'Pendente' : 'Solicitar'}
                                </Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.msgClube}
                              onPress={() => void handleAulas(r)}
                              disabled={enviando === `aula-${r.id}`}
                            >
                              <Text style={styles.msgClubeTxt}>Quero aulas</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </>
              )}
            </>
          ) : loadingTorneios ? (
            <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
          ) : torneiosFiltrados.length === 0 ? (
            <Text style={styles.empty}>Nenhum torneio de {esporteNome} por perto.</Text>
          ) : (
            <>
              <Text style={styles.section}>Torneios · {esporteNome}</Text>
              {torneiosFiltrados.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.torneioCard}
                  onPress={() => router.push(`/torneio/${t.id}`)}
                >
                  <Text style={styles.clubeNome}>{t.nome}</Text>
                  <Text style={styles.clubeMeta}>
                    {t.clubeNome} · {t.cidade}
                  </Text>
                  <Text style={styles.clubeMembros}>
                    {t.dataInicio || 'Datas a definir'} · {t.status}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function SolicitacaoRow({ sol }: { sol: Solicitacao }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function agir(aceitar: boolean) {
    setBusy(true);
    try {
      if (aceitar) await aceitarSolicitacao(sol);
      else await recusarSolicitacao(sol.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.solRow}>
      <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/jogador/${sol.uid}`)}>
        <Text style={styles.solNome}>{sol.nome}</Text>
        <Text style={styles.solMeta}>
          {sol.rankingNome} · {sol.clubeNome}
        </Text>
      </TouchableOpacity>
      {busy ? (
        <ActivityIndicator color={Colors.accent} />
      ) : (
        <View style={styles.solActions}>
          <TouchableOpacity style={styles.aceitar} onPress={() => void agir(true)}>
            <Ionicons name="checkmark" size={18} color={Colors.textOnAccent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.recusar} onPress={() => void agir(false)}>
            <Ionicons name="close" size={18} color={Colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  esporteHint: { color: Colors.accent, fontWeight: '600', marginBottom: 4 },
  esporteHint2: { color: Colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  meusClubesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  meusClubesTxt: { color: Colors.textOnAccent, fontWeight: '700', fontSize: 13, flex: 1 },
  verClubeLink: { paddingVertical: 8, paddingHorizontal: 4 },
  verClubeTxt: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.white,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabTxt: { color: Colors.textPrimary, fontWeight: '700' },
  tabTxtOn: { color: Colors.textOnAccent },
  section: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  clubeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  torneioCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 4,
  },
  clubeInfo: { flex: 1, gap: 2 },
  clubeNome: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  clubeMeta: { color: Colors.textSecondary, fontSize: 13 },
  clubeMembros: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  actionsCol: { gap: 6, alignItems: 'stretch' },
  solicitarBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  pendenteBtn: { backgroundColor: Colors.pillMuted },
  solicitarTxt: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 13 },
  msgClube: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 8,
    alignItems: 'center',
  },
  msgClubeTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 11 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12, marginBottom: 12 },
  solBox: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 8,
  },
  solTitle: { color: Colors.accent, fontWeight: 'bold' },
  solRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  solNome: { color: Colors.textPrimary, fontWeight: '600' },
  solMeta: { color: Colors.textSecondary, fontSize: 12 },
  solActions: { flexDirection: 'row', gap: 8 },
  aceitar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recusar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
