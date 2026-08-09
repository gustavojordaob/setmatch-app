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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { ESPORTES } from '../../constants/esportes';
import { NOTICIAS } from '../../constants/noticias';
import { Typography } from '../../constants/typography';
import { Avatar } from '../../components/ui/Avatar';
import { RecentMatchCard } from '../../components/home/RecentMatchCard';
import { useAuth } from '../../hooks/useAuth';
import { useFeedFiltrado } from '../../hooks/useFeed';
import { useAmigos } from '../../hooks/useAmigos';
import { formatDataPartida, usePartidas } from '../../hooks/usePartidas';
import { usePartidasAmigos } from '../../hooks/useTorneios';
import { useEsporte } from '../../contexts/EsporteContext';
import { useClube } from '../../contexts/ClubeContext';
import { EsporteSwitcher } from '../../components/EsporteSwitcher';
import { ClubeSwitcher } from '../../components/ClubeSwitcher';
import { alternarCurtida, criarPost } from '../../services/feed';
import { useDesafios } from '../../hooks/useDesafios';
import { useT } from '../../hooks/useI18n';
import { useTotalNaoLidas } from '../../hooks/useTotalNaoLidas';
import { UnreadBadge } from '../../components/ui/UnreadBadge';
import { uploadFotoPost } from '../../utils/uploadFoto';
import { compartilharPostFora } from '../../utils/compartilharPost';

type TabKey = 'resultados' | 'proximas';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

export default function HomeScreen() {
  const router = useRouter();
  const t = useT();
  const { user, perfil } = useAuth();
  const msgsNaoLidas = useTotalNaoLidas();
  const { esporteAtivo } = useEsporte();
  const { clubeAtivoId, clubeAtivo } = useClube();
  const esporteLabel = t(`esporte.${esporteAtivo}`);
  const { amigoUids } = useAmigos();
  const { recebidosPendentes, enviadosPendentes } = useDesafios();
  const [soAmigos, setSoAmigos] = useState(false);
  const { posts, loading: feedLoading } = useFeedFiltrado({
    esporte: esporteAtivo,
    clubeId: clubeAtivoId,
    soAmigos,
    amigoUids,
    meuUid: user?.uid,
  });
  const { partidas } = usePartidas();
  const { partidas: partidasAmigos } = usePartidasAmigos(amigoUids, esporteAtivo);
  const [aba, setAba] = useState<TabKey>('resultados');
  const [texto, setTexto] = useState('');
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [publicando, setPublicando] = useState(false);

  const nome = perfil?.nome ?? user?.displayName ?? 'Gustavo';
  const record = useMemo(() => {
    const v = perfil?.vitorias ?? 30;
    const d = perfil?.derrotas ?? 7;
    return `${v}V ${d}D`;
  }, [perfil?.vitorias, perfil?.derrotas]);

  const partidasRecentes = useMemo(() => {
    return partidas
      .filter((p) => (p.esporte || 'tenis') === esporteAtivo)
      .filter((p) => {
        if (!clubeAtivoId) return true;
        const cid = (p as { clubeId?: string }).clubeId;
        return !cid || cid === clubeAtivoId;
      })
      .slice(0, 8);
  }, [partidas, esporteAtivo, clubeAtivoId]);

  const recebidosEsporte = useMemo(
    () => recebidosPendentes.filter((d) => (d.esporte || 'tenis') === esporteAtivo),
    [recebidosPendentes, esporteAtivo]
  );
  const enviadosEsporte = useMemo(
    () => enviadosPendentes.filter((d) => (d.esporte || 'tenis') === esporteAtivo),
    [enviadosPendentes, esporteAtivo]
  );

  /** Feed unificado: posts + jogos (resultados) do esporte/clube. */
  const jogosNoFeed = useMemo(() => {
    const fonte = soAmigos ? partidasAmigos : partidasRecentes;
    return fonte.slice(0, 10);
  }, [soAmigos, partidasAmigos, partidasRecentes]);

  const noticiasEsporte = useMemo(
    () => NOTICIAS.filter((n) => n.esporte === esporteAtivo),
    [esporteAtivo]
  );

  async function escolherFoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('common.permission'), t('home.permissionPhotos'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setFotoUri(result.assets[0].uri);
    }
  }

  async function publicar() {
    if (!user || (!texto.trim() && !fotoUri)) return;
    setPublicando(true);
    try {
      let imagemUrl: string | undefined;
      if (fotoUri) {
        imagemUrl = await uploadFotoPost(fotoUri);
      }
      await criarPost({
        autorUid: user.uid,
        autorNome: nome,
        autorFoto: perfil?.fotoUrl ?? user.photoURL ?? '',
        texto,
        imagemUrl,
        esporte: esporteAtivo,
        clubeId: clubeAtivoId ?? undefined,
      });
      setTexto('');
      setFotoUri(null);
    } catch (e: unknown) {
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : t('home.publishFailed')
      );
    } finally {
      setPublicando(false);
    }
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Avatar uri={perfil?.fotoUrl ?? user?.photoURL} nome={nome} size="md" verified />
              <View>
                <Text style={styles.nome}>{nome} ✓</Text>
                <Text style={styles.record}>{record}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.bell}
              onPress={() => router.push('/(tabs)/notificacoes')}
            >
              <Ionicons name="notifications-outline" size={22} color={Colors.white} />
              <UnreadBadge count={msgsNaoLidas} dotOnly />
            </TouchableOpacity>
          </View>

          <EsporteSwitcher variant="circles" />
          <ClubeSwitcher />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={{ paddingBottom: TAB_PAD_BOTTOM }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.inviteBanner}
          onPress={() => router.push('/desafio/novo')}
        >
          <Ionicons name="tennisball-outline" size={22} color={Colors.textOnAccent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.inviteTitle}>{t('home.inviteToPlay')}</Text>
            <Text style={styles.inviteSub}>
              Chame amigos ou jogadores · {esporteLabel}
              {clubeAtivo ? ` · ${clubeAtivo.nome}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textOnAccent} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pertoBanner}
          onPress={() => router.push('/(tabs)/proximos')}
        >
          <Ionicons name="navigate-outline" size={22} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pertoTitle}>{t('home.nearMeTitle')}</Text>
            <Text style={styles.pertoSub}>{t('home.nearMeSubtitle')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMutedDark} />
        </TouchableOpacity>

        {recebidosEsporte.length > 0 || enviadosEsporte.length > 0 ? (
          <View style={styles.convitesBox}>
            <View style={styles.convitesHead}>
              <Text style={styles.section}>{t('home.confrontos')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/desafios')}>
                <Text style={styles.amigosLink}>{t('nav.seeAll')}</Text>
              </TouchableOpacity>
            </View>

            {recebidosEsporte.length > 0 ? (
              <View style={styles.confrontoAlert}>
                <Ionicons name="mail-unread" size={16} color={Colors.textOnAccent} />
                <Text style={styles.confrontoAlertTxt}>
                  {recebidosEsporte.length} convite
                  {recebidosEsporte.length > 1 ? 's' : ''} aguardando sua resposta
                </Text>
              </View>
            ) : null}

            {[...recebidosEsporte, ...enviadosEsporte].slice(0, 3).map((d) => {
              const recebido = d.desafiado === user?.uid;
              const outroNome = recebido ? d.desafianteNome : d.desafiadoNome;
              const outroFoto = recebido ? d.desafianteFoto : d.desafiadoFoto;
              return (
                <TouchableOpacity
                  key={d.id}
                  style={styles.conviteRow}
                  onPress={() => router.push(`/desafio/${d.id}`)}
                >
                  <Avatar uri={outroFoto} nome={outroNome} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.conviteTxt} numberOfLines={1}>
                      {outroNome}
                    </Text>
                    <Text style={styles.conviteSub}>
                      {recebido ? 'Te desafiou' : 'Convite enviado'} ·{' '}
                      {d.quadra || 'A combinar'}
                    </Text>
                  </View>
                  {recebido ? (
                    <View style={styles.novoTag}>
                      <Text style={styles.novoTagTxt}>{t('home.respond')}</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        <View style={styles.toggleRow}>
          <TouchableOpacity
            onPress={() => setAba('resultados')}
            style={[styles.toggleBtn, aba === 'resultados' && styles.toggleOn]}
          >
            <Text style={[styles.toggleTxt, aba === 'resultados' && styles.toggleTxtOn]}>
              Resultados
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setAba('proximas')}
            style={[styles.toggleBtn, aba === 'proximas' && styles.toggleOn]}
          >
            <Text style={[styles.toggleTxt, aba === 'proximas' && styles.toggleTxtOn]}>
              {t('home.upcomingMatches')}
            </Text>
          </TouchableOpacity>
        </View>

        {aba === 'resultados' ? (
          <>
            <Text style={styles.section}>
              {soAmigos ? 'Jogos dos amigos' : 'Minhas partidas recentes'}
            </Text>
            {(soAmigos ? partidasAmigos : partidasRecentes).length === 0 ? (
              <Text style={styles.empty}>
                {soAmigos
                  ? t('home.friendsNoGames')
                  : 'Sem partidas registradas ainda.'}
              </Text>
            ) : (
              (soAmigos ? partidasAmigos : partidasRecentes).map((p) => {
                const euSouJ1 = user?.uid === p.jogador1;
                const vitoria = soAmigos
                  ? amigoUids.has(p.vencedor)
                  : p.vencedor === user?.uid;
                const setsJ1 = p.sets.map((s) => s.j1);
                const setsJ2 = p.sets.map((s) => s.j2);
                const nome1 = p.jogador1Nome ?? (euSouJ1 ? nome : 'Jogador');
                const nome2 = p.jogador2Nome ?? (!euSouJ1 ? nome : 'Adversário');
                const tipoLabel = p.tipo === 'ranking' ? 'Ranking' : 'Amistoso';
                const dataLabel =
                  'dataPartida' in p && p.dataPartida?.seconds
                    ? formatDataPartida(p as Parameters<typeof formatDataPartida>[0])
                    : '';
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() =>
                      router.push(`/jogador/${euSouJ1 ? p.jogador2 : p.jogador1}`)
                    }
                  >
                    <RecentMatchCard
                      vitoria={vitoria}
                      jogador1={{
                        nome: nome1,
                        sets: setsJ1,
                        winner: p.vencedor === p.jogador1,
                      }}
                      jogador2={{
                        nome: nome2,
                        sets: setsJ2,
                        winner: p.vencedor === p.jogador2,
                      }}
                      data={`${tipoLabel}${dataLabel ? ` · ${dataLabel}` : ''}`}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : (
          <Text style={styles.empty}>{t('home.noScheduled')}</Text>
        )}

        {/* Notícias do mundo do tênis / padel */}
        <Text style={[styles.section, { marginTop: 28 }]}>{t('home.news')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.newsRow}
        >
          {(noticiasEsporte.length === 0
            ? [{ id: 'empty', titulo: t('home.noNews', { sport: esporteLabel }), fonte: 'Setmatch', categoria: '', esporte: esporteAtivo }]
            : noticiasEsporte
          ).map((n) => (
            <View key={n.id} style={styles.newsCard}>
              <View style={styles.newsTag}>
                <Text style={styles.newsTagTxt}>
                  {n.categoria || esporteLabel}
                </Text>
              </View>
              <Text style={styles.newsTitle} numberOfLines={4}>
                {n.titulo}
              </Text>
              <Text style={styles.newsFonte}>{n.fonte}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.feedHead}>
          <Text style={styles.section}>
            Feed{clubeAtivo ? ` · ${clubeAtivo.nome}` : ''}
          </Text>
          <View style={styles.feedLinks}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/proximos')}>
              <Text style={styles.amigosLink}>{t('nav.nearMe')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/buscar')}>
              <Text style={styles.amigosLink}>{t('nav.search')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/(tabs)/amigos')}>
              <Text style={styles.amigosLink}>{t('nav.friends')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {jogosNoFeed.length > 0 ? (
          <>
            <Text style={styles.feedSub}>{t('home.feedGames')}</Text>
            {jogosNoFeed.map((p) => {
              const euSouJ1 = user?.uid === p.jogador1;
              const vitoria = soAmigos
                ? amigoUids.has(p.vencedor)
                : p.vencedor === user?.uid;
              const setsJ1 = p.sets.map((s) => s.j1);
              const setsJ2 = p.sets.map((s) => s.j2);
              const nome1 = p.jogador1Nome ?? (euSouJ1 ? nome : 'Jogador');
              const nome2 = p.jogador2Nome ?? (!euSouJ1 ? nome : 'Adversário');
              return (
                <RecentMatchCard
                  key={`feed-jogo-${p.id}`}
                  vitoria={vitoria}
                  jogador1={{
                    nome: nome1,
                    sets: setsJ1,
                    winner: p.vencedor === p.jogador1,
                  }}
                  jogador2={{
                    nome: nome2,
                    sets: setsJ2,
                    winner: p.vencedor === p.jogador2,
                  }}
                  data="Resultado"
                />
              );
            })}
          </>
        ) : null}
        <View style={styles.feedToggle}>
          <TouchableOpacity
            style={[styles.feedChip, !soAmigos && styles.feedChipOn]}
            onPress={() => setSoAmigos(false)}
          >
            <Text style={[styles.feedChipTxt, !soAmigos && styles.feedChipTxtOn]}>
              {t('home.filterAll')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.feedChip, soAmigos && styles.feedChipOn]}
            onPress={() => setSoAmigos(true)}
          >
            <Text style={[styles.feedChipTxt, soAmigos && styles.feedChipTxtOn]}>
              {t('home.filterFriends')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <Avatar uri={perfil?.fotoUrl ?? user?.photoURL} nome={nome} size="sm" />
            <TextInput
              style={styles.composerInput}
              placeholder={`Compartilhe algo de ${esporteLabel}…`}
              placeholderTextColor={Colors.textMutedDark}
              value={texto}
              onChangeText={setTexto}
              multiline
            />
            <TouchableOpacity style={styles.fotoBtn} onPress={() => void escolherFoto()}>
              <Ionicons name="image-outline" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.postBtn, !texto.trim() && !fotoUri && styles.postBtnOff]}
              onPress={() => void publicar()}
              disabled={(!texto.trim() && !fotoUri) || publicando}
            >
              {publicando ? (
                <ActivityIndicator color={Colors.textOnAccent} size="small" />
              ) : (
                <Ionicons name="send" size={18} color={Colors.textOnAccent} />
              )}
            </TouchableOpacity>
          </View>
          {fotoUri ? (
            <View style={styles.fotoPreviewRow}>
              <Image source={{ uri: fotoUri }} style={styles.fotoPreview} />
              <TouchableOpacity onPress={() => setFotoUri(null)}>
                <Text style={styles.fotoRemover}>{t('home.removePhoto')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {feedLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : posts.length === 0 ? (
          <Text style={styles.feedEmpty}>
            Nenhum post de {esporteLabel} ainda. Seja o primeiro!
          </Text>
        ) : (
          posts.map((p) => {
            const curtido = user ? p.curtidoPor.includes(user.uid) : false;
            const espId = p.esporte ?? 'tenis';
            const espMeta = ESPORTES.find((e) => e.id === espId);
            return (
              <View key={p.id} style={styles.postCard}>
                <TouchableOpacity
                  style={styles.postHead}
                  onPress={() => router.push(`/jogador/${p.autorUid}`)}
                  activeOpacity={0.8}
                >
                  <Avatar uri={p.autorFoto} nome={p.autorNome} size="sm" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postAutor}>{p.autorNome}</Text>
                    {espMeta ? (
                      <Text style={styles.postEsporte}>
                        {espMeta.emoji} {t(`esporte.${espId}`)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.postEsporteBadge}>{espMeta?.emoji ?? '🎾'}</Text>
                </TouchableOpacity>
                {p.texto ? <Text style={styles.postTexto}>{p.texto}</Text> : null}
                {p.imagemUrl ? (
                  <TouchableOpacity onPress={() => router.push(`/post/${p.id}`)}>
                    <Image source={{ uri: p.imagemUrl }} style={styles.postImg} />
                  </TouchableOpacity>
                ) : null}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.likeRow}
                    onPress={() => user && alternarCurtida(p.id, user.uid, !curtido)}
                  >
                    <Ionicons
                      name={curtido ? 'heart' : 'heart-outline'}
                      size={18}
                      color={curtido ? Colors.danger : Colors.textMutedDark}
                    />
                    <Text style={styles.likeTxt}>{p.curtidas}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.likeRow}
                    onPress={() => router.push(`/post/${p.id}`)}
                  >
                    <Ionicons
                      name="chatbubble-outline"
                      size={17}
                      color={Colors.textMutedDark}
                    />
                    <Text style={styles.likeTxt}>{p.comentariosCount}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.likeRow}
                    onPress={() =>
                      void compartilharPostFora({
                        postId: p.id,
                        autorNome: p.autorNome,
                        texto: p.texto,
                      })
                    }
                  >
                    <Ionicons name="share-outline" size={18} color={Colors.textMutedDark} />
                    <Text style={styles.likeTxt}>{t('home.share')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bodyLight },
  headerSafe: { backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  nome: { ...Typography.userName, color: Colors.textPrimary, fontSize: 30 },
  record: { color: Colors.textPrimary, fontSize: 14, marginTop: 2, opacity: 0.9 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportsRow: { flexDirection: 'row', gap: 12 },
  sportCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportCircleOn: { borderWidth: 2, borderColor: Colors.accent },
  sportEmoji: { fontSize: 22 },
  sportEmojiOff: { opacity: 0.45 },
  bodyScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  inviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.accent,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  inviteTitle: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 15 },
  inviteSub: { color: Colors.textOnAccent, opacity: 0.85, fontSize: 12, marginTop: 2 },
  pertoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  pertoTitle: { color: Colors.textDark, fontWeight: 'bold', fontSize: 15 },
  pertoSub: { color: Colors.textMutedDark, fontSize: 12, marginTop: 2 },
  convitesBox: { marginBottom: 8 },
  convitesHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confrontoAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  confrontoAlertTxt: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 13, flex: 1 },
  conviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  conviteTxt: { color: Colors.textDark, fontWeight: 'bold', fontSize: 14 },
  conviteSub: { color: Colors.textMutedDark, fontSize: 12, marginTop: 1 },
  novoTag: {
    backgroundColor: Colors.primary,
    borderRadius: 60,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  novoTagTxt: { color: Colors.textPrimary, fontSize: 10, fontWeight: 'bold' },
  feedSub: {
    color: Colors.textMutedDark,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 30,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 26,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: Colors.background },
  toggleTxt: { color: Colors.textDark, fontWeight: '700', fontSize: 13 },
  toggleTxtOn: { color: Colors.textPrimary },
  section: { color: Colors.textDark, fontWeight: 'bold', fontSize: 18, marginBottom: 14 },
  feedHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
  },
  feedLinks: { flexDirection: 'row', gap: 16, marginBottom: 14 },
  amigosLink: { color: Colors.accent, fontWeight: 'bold', fontSize: 14 },
  feedToggle: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  feedChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.white,
  },
  feedChipOn: { backgroundColor: Colors.primary },
  feedChipTxt: { color: Colors.textDark, fontWeight: '700', fontSize: 12 },
  feedChipTxtOn: { color: Colors.textPrimary },
  empty: { color: Colors.textMutedDark, textAlign: 'center', marginTop: 24 },
  newsRow: { gap: 12, paddingRight: 8, paddingBottom: 4 },
  newsCard: {
    width: 220,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  newsTag: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  newsTagTxt: { color: Colors.textOnAccent, fontSize: 11, fontWeight: 'bold' },
  newsTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  newsFonte: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  composerWrap: { marginBottom: 16 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 12,
  },
  composerInput: {
    flex: 1,
    color: Colors.textDark,
    fontSize: 14,
    maxHeight: 120,
    paddingTop: 4,
  },
  fotoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fotoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  fotoPreview: { width: 72, height: 72, borderRadius: 12 },
  fotoRemover: { color: Colors.danger, fontWeight: '700', fontSize: 13 },
  postBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnOff: { opacity: 0.4 },
  feedEmpty: { color: Colors.textMutedDark, textAlign: 'center', marginTop: 12 },
  postCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postAutor: { color: Colors.textDark, fontWeight: 'bold', fontSize: 14 },
  postEsporte: { color: Colors.textMutedDark, fontSize: 11, marginTop: 1 },
  postEsporteBadge: { fontSize: 22 },
  postTexto: { color: Colors.textDark, fontSize: 14, lineHeight: 20 },
  postImg: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: Colors.bodyLight,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 2,
  },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  likeTxt: { color: Colors.textMutedDark, fontSize: 13, fontWeight: '600' },
});
