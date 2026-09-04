import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../utils/firebaseConfig';
import { Colors } from '../../../constants/colors';
import { Radius } from '../../../constants/radius';
import { Avatar } from '../../../components/ui/Avatar';
import { useAuth } from '../../../hooks/useAuth';
import { useClassificacao } from '../../../hooks/useRankings';
import {
  sugerirAdversariosRanking,
  type AdversarioSugerido,
} from '../../../services/rankings';
import { criarDesafio } from '../../../services/desafios';
import { abrirOuCriarConversaAmigo } from '../../../services/mensagens';
import { abrirWhatsApp } from '../../../utils/whatsapp';
import {
  labelFormatoRanking,
  labelModeloRanking,
  normalizarNiveisConfig,
  normalizarRegrasJogo,
  type Ranking,
  type RankingRegrasJogo,
} from '../../../types/ranking';
import type { EsporteId } from '../../../constants/esportes';
import type { FormatoPartidaId } from '../../../constants/formatosPartida';

type AbaConfrontos = 'meus' | 'todos' | 'sugeridos';

type ConfrontoItem = {
  id: string;
  j1Uid: string;
  j2Uid: string;
  j1Nome: string;
  j2Nome: string;
  j1Foto?: string;
  j2Foto?: string;
  status: string;
};

export default function RankingConfrontosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { rows, loading: loadClass } = useClassificacao(id ?? null);
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [todos, setTodos] = useState<ConfrontoItem[]>([]);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaConfrontos>('sugeridos');

  const regras: RankingRegrasJogo = useMemo(
    () => normalizarRegrasJogo(ranking?.regrasJogo),
    [ranking?.regrasJogo]
  );

  const sugeridos = useMemo(() => {
    if (!user) return [] as AdversarioSugerido[];
    const niveisOn = Boolean(ranking?.niveis?.ativo);
    if (regras.modelo === 'todos_contra_todos') {
      const base = niveisOn
        ? rows.filter((r) => {
            const eu = rows.find((x) => x.uid === user.uid);
            return r.uid !== user.uid && (r.nivelId || '') === (eu?.nivelId || '');
          })
        : rows.filter((r) => r.uid !== user.uid);
      return base.slice(0, 12).map((r, i) => ({
        ...r,
        posicao: i + 1,
        direcao: 'abaixo' as const,
      }));
    }
    return sugerirAdversariosRanking(rows, user.uid, regras, {
      mesmoNivelOnly: niveisOn,
    });
  }, [rows, user, regras, ranking?.niveis?.ativo]);

  const meus = useMemo(() => {
    if (!user) return [];
    return todos.filter((c) => c.j1Uid === user.uid || c.j2Uid === user.uid);
  }, [todos, user]);

  const abertosMeus = useMemo(
    () => meus.filter((c) => c.status !== 'finalizado' && c.status !== 'recusado'),
    [meus]
  );

  const carregar = useCallback(async () => {
    if (!id || !user) return;
    const snap = await getDoc(doc(db, 'rankings', id));
    if (snap.exists()) {
      const raw = snap.data();
      setRanking({
        id: snap.id,
        nome: String(raw.nome ?? ''),
        clubeId: String(raw.clubeId ?? ''),
        clubeNome: String(raw.clubeNome ?? ''),
        cidade: String(raw.cidade ?? ''),
        esporte: (raw.esporte as EsporteId) ?? 'tenis',
        donoUid: String(raw.donoUid ?? ''),
        membros: (raw.membros as string[]) ?? [],
        totalMembros: Number(raw.totalMembros ?? 0),
        regrasJogo: raw.regrasJogo as RankingRegrasJogo | undefined,
        niveis: raw.niveis
          ? normalizarNiveisConfig(raw.niveis as import('../../../types/ranking').RankingNiveisConfig)
          : undefined,
      });
    }
    const q = query(collection(db, 'desafios'), where('rankingId', '==', id));
    const dSnap = await getDocs(q);
    setTodos(
      dSnap.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          j1Uid: String(r.desafiante ?? ''),
          j2Uid: String(r.desafiado ?? ''),
          j1Nome: String(r.desafianteNome ?? 'Jogador'),
          j2Nome: String(r.desafiadoNome ?? 'Jogador'),
          j1Foto: r.desafianteFoto ? String(r.desafianteFoto) : undefined,
          j2Foto: r.desafiadoFoto ? String(r.desafiadoFoto) : undefined,
          status: String(r.status ?? 'pendente'),
        };
      })
    );
  }, [id, user]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function marcarJogo(adv: AdversarioSugerido) {
    if (!user || !perfil || !ranking) return;
    setBusyUid(adv.uid);
    try {
      const [euSnap, advSnap] = await Promise.all([
        getDoc(doc(db, 'rankings', ranking.id, 'classificacao', user.uid)),
        getDoc(doc(db, 'rankings', ranking.id, 'classificacao', adv.uid)),
      ]);
      const eu = euSnap.data() || {};
      const advC = advSnap.data() || {};
      const desafioId = await criarDesafio({
        desafiante: user.uid,
        desafianteNome: perfil.nome,
        desafianteFoto: perfil.fotoUrl,
        desafianteParceiroUid: eu.parceiroUid ? String(eu.parceiroUid) : undefined,
        desafianteParceiroNome: eu.parceiroNome ? String(eu.parceiroNome) : undefined,
        desafianteParceiroFoto: eu.parceiroFoto ? String(eu.parceiroFoto) : undefined,
        desafiado: adv.uid,
        desafiadoNome: adv.nome,
        desafiadoFoto: adv.fotoUrl,
        desafiadoParceiroUid: advC.parceiroUid ? String(advC.parceiroUid) : undefined,
        desafiadoParceiroNome: advC.parceiroNome
          ? String(advC.parceiroNome)
          : undefined,
        desafiadoParceiroFoto: advC.parceiroFoto
          ? String(advC.parceiroFoto)
          : undefined,
        esporte: ranking.esporte,
        clubeId: ranking.clubeId,
        clubeNome: ranking.clubeNome,
        formato: regras.formatoPartidaId as FormatoPartidaId,
        rankingId: ranking.id,
        rankingNome: ranking.nome,
        mensagem: `Confronto do ranking ${ranking.nome}`,
        quadra: ranking.clubeNome,
      });
      setAba('meus');
      Alert.alert('Confronto marcado', 'Desafio enviado. O placar pontua no ranking.', [
        { text: 'Ficar', style: 'cancel', onPress: () => void carregar() },
        { text: 'Abrir', onPress: () => router.push(`/desafio/${desafioId}`) },
      ]);
    } catch (e: unknown) {
      Alert.alert('Ranking', e instanceof Error ? e.message : 'Erro ao marcar');
    } finally {
      setBusyUid(null);
    }
  }

  async function mensagemApp(adv: AdversarioSugerido) {
    if (!user || !perfil) return;
    setBusyUid(adv.uid);
    try {
      const conversaId = await abrirOuCriarConversaAmigo({
        uidA: user.uid,
        nomeA: perfil.nome,
        fotoA: perfil.fotoUrl,
        uidB: adv.uid,
        nomeB: adv.nome,
        fotoB: adv.fotoUrl,
      });
      router.push(`/chat/${conversaId}`);
    } catch (e: unknown) {
      Alert.alert('Chat', e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusyUid(null);
    }
  }

  async function mensagemWhats(adv: AdversarioSugerido) {
    setBusyUid(adv.uid);
    try {
      const uSnap = await getDoc(doc(db, 'usuarios', adv.uid));
      const tel = uSnap.exists() ? String(uSnap.data().telefone ?? '') : '';
      if (!tel) {
        Alert.alert('WhatsApp', 'Este jogador ainda não cadastrou telefone.');
        return;
      }
      await abrirWhatsApp(
        tel,
        `Oi ${adv.nome.split(' ')[0]}! Sou do ranking *${ranking?.nome ?? ''}*. Vamos marcar nosso confronto?`
      );
    } finally {
      setBusyUid(null);
    }
  }

  const souMembro = !!(user && ranking?.membros.includes(user.uid));
  const statusLabel: Record<string, string> = {
    pendente: 'Aguardando',
    aceito: 'Aceito — jogar',
    recusado: 'Recusado',
    finalizado: 'Finalizado',
  };

  function CardConfronto({ c }: { c: ConfrontoItem }) {
    return (
      <TouchableOpacity
        style={styles.matchCard}
        onPress={() => router.push(`/desafio/${c.id}`)}
      >
        <View style={styles.matchVs}>
          <Text style={styles.matchNome} numberOfLines={1}>
            {c.j1Nome.split(' ')[0]}
          </Text>
          <Text style={styles.matchX}>×</Text>
          <Text style={styles.matchNome} numberOfLines={1}>
            {c.j2Nome.split(' ')[0]}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            c.status === 'aceito' && styles.badgeOn,
            c.status === 'finalizado' && styles.badgeDone,
          ]}
        >
          <Text style={styles.badgeTxt}>{statusLabel[c.status] ?? c.status}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          Confrontos
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {ranking ? (
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>{ranking.nome}</Text>
            <Text style={styles.heroMeta}>
              {labelModeloRanking(regras.modelo)} · {labelFormatoRanking(regras.formatoPartidaId)}
            </Text>
            <Text style={styles.heroPts}>
              Vitória limpa {regras.ptsJogoCompleto} pts · jogar +{regras.ptsParticipacao} · quem
              joga pontua
            </Text>
            {abertosMeus.length > 0 ? (
              <View style={styles.heroAlert}>
                <Ionicons name="flash" size={16} color={Colors.textOnAccent} />
                <Text style={styles.heroAlertTxt}>
                  {abertosMeus.length} confronto(s) seu(s) em andamento
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.tabs}>
          {(
            [
              ['sugeridos', 'Quem enfrentar'],
              ['meus', 'Meus'],
              ['todos', 'Do ranking'],
            ] as const
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.tab, aba === key && styles.tabOn]}
              onPress={() => setAba(key)}
            >
              <Text style={[styles.tabTxt, aba === key && styles.tabTxtOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!souMembro ? (
          <Text style={styles.empty}>Entre no ranking para ver e marcar confrontos.</Text>
        ) : loadClass && aba === 'sugeridos' ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : aba === 'sugeridos' ? (
          <>
            <Text style={styles.hint}>
              {regras.modelo === 'todos_contra_todos'
                ? 'Marque com qualquer membro. O placar atualiza os PTS do ranking.'
                : 'Sugestão pela tabela (acima/abaixo). Marque, chame no app ou WhatsApp.'}
            </Text>
            {sugeridos.length === 0 ? (
              <Text style={styles.empty}>Sem adversários sugeridos ainda.</Text>
            ) : (
              sugeridos.map((adv) => {
                const aberto = abertosMeus.find(
                  (a) => a.j1Uid === adv.uid || a.j2Uid === adv.uid
                );
                return (
                  <View key={adv.uid} style={styles.advCard}>
                    <TouchableOpacity
                      style={styles.advTop}
                      onPress={() => router.push(`/jogador/${adv.uid}`)}
                    >
                      <Avatar uri={adv.fotoUrl} nome={adv.nome} size="md" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.advNome}>{adv.nome}</Text>
                        <Text style={styles.advMeta}>
                          #{adv.posicao}
                          {regras.modelo === 'ladder'
                            ? ` · ${adv.direcao === 'acima' ? 'Acima' : 'Abaixo'}`
                            : ''}{' '}
                          · {adv.pts} pts
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {aberto ? (
                      <TouchableOpacity
                        style={styles.ctaFull}
                        onPress={() => router.push(`/desafio/${aberto.id}`)}
                      >
                        <Text style={styles.ctaFullTxt}>
                          Abrir confronto ({statusLabel[aberto.status]})
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={styles.actBtn}
                          onPress={() =>
                            router.push({
                              pathname: '/ranking/[id]/reservar',
                              params: {
                                id: id ?? '',
                                advUid: adv.uid,
                                advNome: adv.nome,
                                advFoto: adv.fotoUrl ?? '',
                              },
                            })
                          }
                          disabled={busyUid === adv.uid}
                        >
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color={Colors.textOnAccent}
                          />
                          <Text style={styles.actTxt}>Horário</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actGhost]}
                          onPress={() => void marcarJogo(adv)}
                          disabled={busyUid === adv.uid}
                        >
                          <Ionicons
                            name="tennisball-outline"
                            size={18}
                            color={Colors.accent}
                          />
                          <Text style={[styles.actTxt, styles.actGhostTxt]}>Desafio</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actGhost]}
                          onPress={() => void mensagemApp(adv)}
                          disabled={busyUid === adv.uid}
                        >
                          <Ionicons name="chatbubble-outline" size={18} color={Colors.accent} />
                          <Text style={[styles.actTxt, styles.actGhostTxt]}>App</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actBtn, styles.actGhost]}
                          onPress={() => void mensagemWhats(adv)}
                          disabled={busyUid === adv.uid}
                        >
                          <Ionicons name="logo-whatsapp" size={18} color={Colors.accent} />
                          <Text style={[styles.actTxt, styles.actGhostTxt]}>Whats</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        ) : aba === 'meus' ? (
          meus.length === 0 ? (
            <Text style={styles.empty}>
              Você ainda não tem confrontos neste ranking. Vá em “Quem enfrentar”.
            </Text>
          ) : (
            meus.map((c) => <CardConfronto key={c.id} c={c} />)
          )
        ) : todos.length === 0 ? (
          <Text style={styles.empty}>Nenhum confronto marcado neste ranking ainda.</Text>
        ) : (
          <>
            <Text style={styles.hint}>Todos os jogos deste ranking (abertos e finalizados).</Text>
            {todos.map((c) => (
              <CardConfronto key={c.id} c={c} />
            ))}
          </>
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
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  hero: {
    backgroundColor: Colors.accent,
    borderRadius: 20,
    padding: 16,
    gap: 6,
  },
  heroTitle: { color: Colors.textOnAccent, fontWeight: '900', fontSize: 18 },
  heroMeta: { color: Colors.textOnAccent, fontWeight: '600', fontSize: 13, opacity: 0.9 },
  heroPts: { color: Colors.textOnAccent, fontSize: 12, lineHeight: 16, opacity: 0.85 },
  heroAlert: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(26,26,26,0.2)',
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroAlertTxt: { color: Colors.textOnAccent, fontWeight: '700', fontSize: 12, flex: 1 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 11, textAlign: 'center' },
  tabTxtOn: { color: Colors.textOnAccent },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 16 },
  advCard: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  advTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  advNome: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  advMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  actBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 12,
  },
  actGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  actTxt: { color: Colors.textOnAccent, fontWeight: '700', fontSize: 13 },
  actGhostTxt: { color: Colors.accent },
  ctaFull: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaFullTxt: { color: Colors.textOnAccent, fontWeight: '800' },
  matchCard: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  matchVs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchNome: { flex: 1, color: Colors.textPrimary, fontWeight: '700' },
  matchX: { color: Colors.accent, fontWeight: '900' },
  badge: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  badgeDone: { opacity: 0.7 },
  badgeTxt: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },
});
