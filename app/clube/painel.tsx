import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
import { useT } from '../../hooks/useI18n';
import { useSolicitacoesRecebidas } from '../../hooks/useRankings';
import { aceitarSolicitacao, recusarSolicitacao } from '../../services/rankings';
import { listarClubesDoDono, type ClubeCompleto } from '../../services/clubes';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import { AccountComplianceLinks } from '../../components/legal/AccountComplianceLinks';
import { UnreadBadge } from '../../components/ui/UnreadBadge';
import { useTotalNaoLidas } from '../../hooks/useTotalNaoLidas';
import {
  normalizarNiveisConfig,
  type RankingNiveisConfig,
  type Solicitacao,
} from '../../types/ranking';

export default function ClubePainelScreen() {
  const router = useRouter();
  const { user, perfil, signOut } = useAuth();
  const t = useT();
  const msgsNaoLidas = useTotalNaoLidas();
  const recebidas = useSolicitacoesRecebidas();
  const [clubes, setClubes] = useState<ClubeCompleto[]>([]);
  const [torneiosCount, setTorneiosCount] = useState(0);
  const [rankingsCount, setRankingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await listarClubesDoDono(user.uid);
      setClubes(list);
      if (list[0]) {
        const tSnap = await getDocs(
          query(collection(db, 'torneios'), where('clubeId', '==', list[0].id))
        );
        const rSnap = await getDocs(
          query(collection(db, 'rankings'), where('clubeId', '==', list[0].id))
        );
        setTorneiosCount(tSnap.size);
        setRankingsCount(rSnap.size);
      } else {
        setTorneiosCount(0);
        setRankingsCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const clube = clubes[0];

  function confirmarLogout() {
    Alert.alert(t('perfil.logoutTitle'), t('perfil.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('perfil.logout'),
        style: 'destructive',
        onPress: () => {
          void signOut().then(() => router.replace('/onboarding'));
        },
      },
    ]);
  }

  async function aceitarComNivel(s: Solicitacao) {
    try {
      const snap = await getDoc(doc(db, 'rankings', s.rankingId));
      const cfg = normalizarNiveisConfig(
        snap.exists()
          ? (snap.data()?.niveis as RankingNiveisConfig | undefined)
          : undefined
      );
      if (!cfg.ativo || cfg.niveis.length < 2) {
        await aceitarSolicitacao(s);
        return;
      }
      Alert.alert(
        'Escolher nível',
        `Em qual nível colocar ${s.nome}?`,
        [
          ...cfg.niveis.map((n) => ({
            text: n.nome,
            onPress: () => {
              void aceitarSolicitacao(s, { nivelId: n.id }).catch((e: unknown) =>
                Alert.alert('Erro', e instanceof Error ? e.message : 'Falha')
              );
            },
          })),
          { text: t('common.cancel'), style: 'cancel' as const },
        ]
      );
    } catch (e: unknown) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao aceitar');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {perfil?.role === 'professor' ? t('clube.professorPanel') : t('clube.panelTitle')}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push('/(tabs)/notificacoes')}
            accessibilityLabel={t('nav.notifications')}
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.white} />
            <UnreadBadge count={msgsNaoLidas} dotOnly />
          </TouchableOpacity>
          <TouchableOpacity onPress={confirmarLogout} accessibilityLabel={t('perfil.logoutTitle')}>
            <Ionicons name="log-out-outline" size={24} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={carregar} tintColor={Colors.accent} />}
      >
        <Text style={styles.hello}>{t('clube.hello', { name: perfil?.nome ?? '' })}</Text>
        {perfil?.setmatchId ? (
          <Text style={styles.idHint}>{t('clube.yourId', { id: perfil.setmatchId })}</Text>
        ) : null}
        <Button
          label={t('clube.editMyProfile')}
          variant="outline"
          onPress={() => router.push('/perfil/editar')}
        />
        <Action
          icon="notifications-outline"
          label={t('notificacoes.title')}
          badge={msgsNaoLidas}
          onPress={() => router.push('/(tabs)/notificacoes')}
        />
        <Action
          icon="chatbubbles-outline"
          label={t('clube.clubMessages')}
          badge={msgsNaoLidas}
          onPress={() => router.push('/clube/mensagens')}
        />

        {!clube && !loading ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {perfil?.role === 'professor' ? t('clube.spaceProfessor') : t('clube.registerClub')}
            </Text>
            <Text style={styles.cardSub}>
              {perfil?.role === 'professor'
                ? t('clube.professorHint')
                : t('clube.registerClubHint')}
            </Text>
            <Button
              label={t('clube.publishClasses')}
              onPress={() => router.push('/clube/aulas-publicar')}
            />
            {perfil?.role !== 'professor' ? (
              <Button label={t('clube.createMyClub')} onPress={() => router.push('/clube/novo')} />
            ) : (
              <Button
                label={t('clube.registerLocalOptional')}
                variant="outline"
                onPress={() => router.push('/clube/novo')}
              />
            )}
          </View>
        ) : null}

        {loading && !clube ? <ActivityIndicator color={Colors.accent} /> : null}

        {clube ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{clube.nome}</Text>
              <Text style={styles.cardSub}>
                {[clube.endereco, clube.bairro, clube.cidade, clube.estado]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {clube.telefone ? (
                <Text style={styles.cardSub}>Tel: {clube.telefone}</Text>
              ) : null}
              <View style={styles.stats}>
                <Stat n={rankingsCount} label={t('trofeu.rankings')} />
                <Stat n={torneiosCount} label={t('trofeu.tournaments')} />
                <Stat n={recebidas.length} label="Solicitações" />
              </View>
              <Button
                label="Editar clube"
                variant="outline"
                onPress={() => router.push({ pathname: '/clube/editar', params: { id: clube.id } })}
              />
            </View>

            <Text style={styles.section}>Gerenciar</Text>
            <Action
              icon="trophy-outline"
              label={t('clube.createRanking')}
              onPress={() =>
                router.push({
                  pathname: '/clube/ranking-novo',
                  params: { clubeId: clube.id },
                })
              }
            />
            <Action
              icon="calendar-outline"
              label={t('clube.myTournaments')}
              onPress={() => router.push('/clube/torneios')}
            />
            <Action
              icon="tennisball-outline"
              label="Agenda de quadras"
              onPress={() =>
                router.push({
                  pathname: '/clube/agenda',
                  params: { clubeId: clube.id },
                })
              }
            />
            <Action
              icon="add-circle-outline"
              label={t('clube.createTournament')}
              onPress={() =>
                router.push({
                  pathname: '/clube/torneio-novo',
                  params: { clubeId: clube.id },
                })
              }
            />
            <Action
              icon="school-outline"
              label="Regras gerais de aulas"
              onPress={() => router.push('/clube/aulas-regras')}
            />
            <Action
              icon="videocam-outline"
              label={t('clube.publishClasses')}
              onPress={() => router.push('/clube/aulas-publicar')}
            />
            <Action
              icon="fitness-outline"
              label="Modalidades (trio, beach…)"
              onPress={() => router.push('/clube/aulas-modalidades')}
            />
            <Action
              icon="people-outline"
              label={t('clube.studentsDiscount')}
              onPress={() => router.push('/clube/alunos')}
            />
            <Action
              icon="cash-outline"
              label={t('clube.financeiro')}
              onPress={() => router.push('/clube/financeiro')}
            />
            <Action
              icon="mail-outline"
              label={t('clube.notifyTournament')}
              onPress={() => router.push('/clube/torneio-mensagens')}
            />

            {recebidas.length > 0 ? (
              <>
                <Text style={styles.section}>{t('clube.rankingRequests')}</Text>
                {recebidas.map((s) => (
                  <View key={s.id} style={styles.solRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.solNome}>{s.nome}</Text>
                      <Text style={styles.solMeta}>{s.rankingNome}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.ok}
                      onPress={() => void aceitarComNivel(s)}
                    >
                      <Ionicons name="checkmark" size={18} color={Colors.textOnAccent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.no}
                      onPress={() => void recusarSolicitacao(s.id)}
                    >
                      <Ionicons name="close" size={18} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : null}

        <AccountComplianceLinks onLogout={confirmarLogout} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  badge = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={22} color={Colors.accent} />
      <Text style={styles.actionTxt}>{label}</Text>
      <UnreadBadge count={badge} />
      <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: Colors.accent, fontSize: 24, fontWeight: 'bold', flex: 1 },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  hello: { color: Colors.textPrimary, fontSize: 16, marginBottom: 4 },
  idHint: { color: Colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  card: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold' },
  cardSub: { color: Colors.textSecondary, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statN: { color: Colors.accent, fontWeight: 'bold', fontSize: 20 },
  statL: { color: Colors.textSecondary, fontSize: 11 },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginTop: 12 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionTxt: { flex: 1, color: Colors.textPrimary, fontWeight: '600' },
  solRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  solNome: { color: Colors.textPrimary, fontWeight: 'bold' },
  solMeta: { color: Colors.textSecondary, fontSize: 12 },
  ok: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  no: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
