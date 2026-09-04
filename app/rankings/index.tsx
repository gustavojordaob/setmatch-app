import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { RankingConnectedCard } from '../../components/ranking/RankingConnectedCard';
import { useMinhasSolicitacoes, useRankings } from '../../hooks/useRankings';
import { solicitarEntrada } from '../../services/rankings';
import { abrirOuCriarConversaClube, enviarMensagem } from '../../services/mensagens';
import { registrarInteresseAulas } from '../../services/torneios';
import { criarRegistroPagamento, solicitarAulas } from '../../services/pagamentos';
import { pagarComEscolhaDeMeio, resumoPromoCurto } from '../../utils/checkoutComMeio';
import { useAuth } from '../../hooks/useAuth';
import { useEsporte } from '../../contexts/EsporteContext';
import { EsporteSwitcher } from '../../components/EsporteSwitcher';
import { ClubeSwitcher } from '../../components/ClubeSwitcher';
import { useClube } from '../../contexts/ClubeContext';
import { db } from '../../utils/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import type { Ranking } from '../../types/ranking';
import { useT } from '../../hooks/useI18n';

type Secao = 'meus' | 'explorar';

export default function RankingsTodosScreen() {
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ secao?: string }>();
  const secaoInicial: Secao = params.secao === 'explorar' ? 'explorar' : 'meus';
  const [secao, setSecao] = useState<Secao>(secaoInicial);

  const { user, perfil } = useAuth();
  const { esporteAtivo } = useEsporte();
  const { clubeAtivo, clubeAtivoId } = useClube();
  const { meus, proximos, loading } = useRankings();
  const minhasSol = useMinhasSolicitacoes();
  const [busca, setBusca] = useState('');
  const [enviando, setEnviando] = useState<string | null>(null);

  const esporteNome = t(`esporte.${esporteAtivo}`);
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
    const q = busca.trim().toLowerCase();
    return proximos.filter((r) => {
      if (r.esporte !== esporteAtivo) return false;
      if (clubeAtivoId && r.clubeId !== clubeAtivoId) return false;
      if (q) {
        return (
          r.nome.toLowerCase().includes(q) ||
          r.clubeNome.toLowerCase().includes(q) ||
          r.cidade.toLowerCase().includes(q)
        );
      }
      if (minhaCidade) return r.cidade.toLowerCase().includes(minhaCidade);
      return true;
    });
  }, [busca, proximos, esporteAtivo, minhaCidade, clubeAtivoId]);

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
          [
            `Taxa R$ ${r.pagamento.valor.toFixed(2)} (${r.pagamento.ciclo === 'mensal' ? 'mensal' : 'única'}).`,
            resumoPromoCurto(r.pagamento) || '',
          ]
            .filter(Boolean)
            .join('\n'),
          [
            {
              text: t('trofeu.payNow'),
              onPress: () =>
                void pagarComEscolhaDeMeio({
                  pagamentoId,
                  titulo: `Ranking · ${r.nome}`,
                  ciclo: r.pagamento!.ciclo,
                  regras: {
                    valor: r.pagamento!.valor,
                    permitePix: r.pagamento!.permitePix,
                    permiteCartao: r.pagamento!.permiteCartao,
                    descontoPixPercent: r.pagamento!.descontoPixPercent,
                    descontoCartaoPercent: r.pagamento!.descontoCartaoPercent,
                    ciclo: r.pagamento!.ciclo,
                  },
                }),
            },
            { text: t('trofeu.myPayments'), onPress: () => router.push('/pagamentos') },
            { text: 'Chat', onPress: () => router.push(`/chat/${conversaId}`) },
          ]
        );
      } else {
        Alert.alert(
          'Solicitação enviada',
          'O dono do clube recebeu o pedido e uma mensagem no chat.',
          [
            { text: t('trofeu.openChat'), onPress: () => router.push(`/chat/${conversaId}`) },
            { text: t('common.ok') },
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
            | {
                ativo?: boolean;
                valorMensal?: number;
                permitePix?: boolean;
                permiteCartao?: boolean;
                descontoPixPercent?: number;
                descontoCartaoPercent?: number;
              }
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
        Alert.alert('Aulas', `Mensalidade R$ ${Number(aulas.valorMensal).toFixed(2)}.`, [
          {
            text: t('trofeu.payNow'),
            onPress: () =>
              void pagarComEscolhaDeMeio({
                pagamentoId,
                titulo: `Aulas · ${r.clubeNome}`,
                ciclo: 'mensal',
                regras: {
                  valor: Number(aulas.valorMensal),
                  permitePix: aulas.permitePix ?? true,
                  permiteCartao: aulas.permiteCartao ?? true,
                  descontoPixPercent: aulas.descontoPixPercent,
                  descontoCartaoPercent: aulas.descontoCartaoPercent,
                  ciclo: 'mensal',
                },
              }),
          },
          { text: t('trofeu.myPayments'), onPress: () => router.push('/pagamentos') },
        ]);
      } else {
        Alert.alert('Interesse registrado', 'O admin vai explicar valores e liberar sua matrícula.', [
          { text: t('trofeu.openChat'), onPress: () => router.push(`/chat/${conversaId}`) },
          { text: t('common.ok') },
        ]);
      }
    } finally {
      setEnviando(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} accessibilityLabel={t('nav.back')}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('trofeu.allRankings')}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <EsporteSwitcher variant="chips" />
        <ClubeSwitcher />
        <Text style={styles.hint}>
          {esporteNome}
          {clubeAtivo ? ` · ${clubeAtivo.nome}` : ''}
        </Text>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, secao === 'meus' && styles.tabOn]}
            onPress={() => setSecao('meus')}
          >
            <Text style={[styles.tabTxt, secao === 'meus' && styles.tabTxtOn]}>
              {t('trofeu.myRankings')} ({meusEsporte.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, secao === 'explorar' && styles.tabOn]}
            onPress={() => setSecao('explorar')}
          >
            <Text style={[styles.tabTxt, secao === 'explorar' && styles.tabTxtOn]}>
              {t('trofeu.exploreRankings')} ({proximosFiltrados.length})
            </Text>
          </TouchableOpacity>
        </View>

        {secao === 'explorar' ? (
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('buscar.clubCity')}
              placeholderTextColor={Colors.textSecondary}
              value={busca}
              onChangeText={setBusca}
            />
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : secao === 'meus' ? (
          meusEsporte.length === 0 ? (
            <Text style={styles.empty}>{t('trofeu.noMyRankings')}</Text>
          ) : (
            meusEsporte.map((r) => (
              <View key={r.id} style={{ marginBottom: 8 }}>
                <RankingConnectedCard
                  ranking={r}
                  pinned
                  onVerMais={() => router.push(`/ranking/${r.id}`)}
                  onConfrontos={() => router.push(`/ranking/${r.id}/confrontos`)}
                />
                <TouchableOpacity
                  style={styles.verClubeLink}
                  onPress={() => router.push(`/meu-clube/${r.clubeId}`)}
                >
                  <Text style={styles.verClubeTxt}>{t('meusClubes.viewClub')}</Text>
                </TouchableOpacity>
              </View>
            ))
          )
        ) : proximosFiltrados.length === 0 ? (
          <Text style={styles.empty}>{t('trofeu.noActiveRanking')}</Text>
        ) : (
          proximosFiltrados.map((r) => {
            const status = statusPorRanking.get(r.id);
            return (
              <View key={r.id} style={styles.clubeCard}>
                <TouchableOpacity
                  style={styles.clubeInfo}
                  onPress={() => router.push(`/ranking/${r.id}`)}
                >
                  <View style={styles.clubeTituloRow}>
                    {r.clubeLogoUrl ? (
                      <Image source={{ uri: r.clubeLogoUrl }} style={styles.clubeLogo} />
                    ) : (
                      <View style={styles.clubeLogoFallback}>
                        <Text style={styles.clubeLogoFallbackTxt}>
                          {r.clubeNome.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.clubeNome} numberOfLines={2}>
                        {r.nome}
                      </Text>
                      <Text style={styles.clubeMeta} numberOfLines={1}>
                        {r.clubeNome} · {r.cidade}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.clubeMembros}>
                    {r.totalMembros} {r.totalMembros === 1 ? 'jogador' : 'jogadores'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.actionsCol}>
                  <TouchableOpacity
                    style={[styles.solicitarBtn, status === 'pendente' && styles.pendenteBtn]}
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
                    <Text style={styles.msgClubeTxt}>{t('aulas.wantClasses')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
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
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  hint: { color: Colors.accent, fontWeight: '600', marginBottom: 12 },
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
  tabTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  tabTxtOn: { color: Colors.textOnAccent },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
  verClubeLink: { paddingVertical: 8, paddingHorizontal: 4 },
  verClubeTxt: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  clubeCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  clubeInfo: { flex: 1, gap: 6 },
  clubeTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clubeLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.white,
    backgroundColor: Colors.surfaceDark,
  },
  clubeLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  clubeLogoFallbackTxt: { color: Colors.white, fontWeight: '800', fontSize: 18 },
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
});
