import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { ESPORTES } from '../../constants/esportes';
import { badgesConquistados } from '../../constants/badges';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { StatsCard } from '../../components/jogador/StatsCard';
import { VsCard } from '../../components/jogador/VsCard';
import { useAuth } from '../../hooks/useAuth';
import { abrirOuCriarConversaAmigo } from '../../services/mensagens';
import { abrirWhatsApp } from '../../utils/whatsapp';
import {
  buscarConfrontosEntre,
  type ConfrontoResumo,
} from '../../services/desafios';
import {
  jogadorFoiCampeao,
  listarPartidasDoJogador,
  type PartidaResumo,
} from '../../services/partidasHistorico';
import { listarPostsDoAutor } from '../../services/feed';
import {
  listarProximosConfrontosTorneio,
  listarTorneiosDoJogador,
  type ConfrontoTorneioUsuario,
  type InscricaoTorneioUsuario,
} from '../../services/confrontosUsuario';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { calcularProbabilidadeVitoria } from '../../utils/probabilidade';
import type { UsuarioPerfil } from '../../contexts/AuthContext';

type AbaPerfil = 'feed' | 'proximos' | 'torneios' | 'partidas';

const ABAS: { id: AbaPerfil; label: string }[] = [
  { id: 'feed', label: 'Feed' },
  { id: 'proximos', label: 'Próximos' },
  { id: 'torneios', label: 'Torneios' },
  { id: 'partidas', label: 'Partidas' },
];

type DesafioAgendado = {
  id: string;
  nome: string;
  quadra: string;
  data?: string;
};

export default function JogadorScreen() {
  const { uid, contexto } = useLocalSearchParams<{
    uid: string;
    contexto?: string;
  }>();
  const router = useRouter();
  const { user, perfil: meuPerfil } = useAuth();
  const modoAlunoClube = contexto === 'aluno_clube';
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<AbaPerfil>('feed');
  const [partidas, setPartidas] = useState<PartidaResumo[]>([]);
  const [h2h, setH2h] = useState<ConfrontoResumo[]>([]);
  const [campeao, setCampeao] = useState(false);
  const [posts, setPosts] = useState<
    { id: string; texto: string; tipo?: string; criadoEm?: { seconds: number } }[]
  >([]);
  const [proximosTorneio, setProximosTorneio] = useState<ConfrontoTorneioUsuario[]>(
    []
  );
  const [desafiosAgendados, setDesafiosAgendados] = useState<DesafioAgendado[]>([]);
  const [torneios, setTorneios] = useState<InscricaoTorneioUsuario[]>([]);

  useEffect(() => {
    if (!uid) return;
    void (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, 'usuarios', uid));
        if (snap.exists()) {
          const d = snap.data();
          setPerfil({
            nome: String(d.nome ?? 'Jogador'),
            fotoUrl: String(d.fotoUrl ?? ''),
            email: String(d.email ?? ''),
            role: (d.role as UsuarioPerfil['role']) ?? 'jogador',
            esportes: (d.esportes as UsuarioPerfil['esportes']) ?? [],
            idade: Number(d.idade ?? 0),
            genero: String(d.genero ?? ''),
            peso: Number(d.peso ?? 0),
            altura: Number(d.altura ?? 0),
            nivel: (d.nivel as UsuarioPerfil['nivel']) ?? '',
            cidade: String(d.cidade ?? ''),
            bairro: String(d.bairro ?? ''),
            estado: String(d.estado ?? ''),
            cep: String(d.cep ?? ''),
            rua: String(d.rua ?? ''),
            telefone: String(d.telefone ?? ''),
            vitorias: Number(d.vitorias ?? 0),
            derrotas: Number(d.derrotas ?? 0),
            onboardingOk: Boolean(d.onboardingOk),
            setmatchId: d.setmatchId ? String(d.setmatchId) : '',
          });
        }

        const [hist, camp, feedPosts, confTorneio, tors] = await Promise.all([
          listarPartidasDoJogador(uid, 15),
          jogadorFoiCampeao(uid),
          listarPostsDoAutor(uid, 20).catch(() => []),
          listarProximosConfrontosTorneio(uid).catch(() => []),
          listarTorneiosDoJogador(uid).catch(() => []),
        ]);
        setPartidas(hist);
        setCampeao(camp);
        setPosts(feedPosts);
        setProximosTorneio(confTorneio);
        setTorneios(tors);

        // Desafios aceitos do jogador (duas queries)
        const [dA, dB] = await Promise.all([
          getDocs(query(collection(db, 'desafios'), where('desafiante', '==', uid))),
          getDocs(query(collection(db, 'desafios'), where('desafiado', '==', uid))),
        ]);
        const map = new Map<string, DesafioAgendado>();
        [...dA.docs, ...dB.docs].forEach((d) => {
          const raw = d.data();
          if (String(raw.status) !== 'aceito') return;
          const outro =
            String(raw.desafiante) === uid
              ? String(raw.desafiadoNome ?? 'Adversário')
              : String(raw.desafianteNome ?? 'Adversário');
          map.set(d.id, {
            id: d.id,
            nome: outro,
            quadra: String(raw.quadra ?? 'A combinar'),
            data: raw.dataSugerida ? String(raw.dataSugerida) : undefined,
          });
        });
        setDesafiosAgendados([...map.values()]);

        if (user && user.uid !== uid && !modoAlunoClube) {
          setH2h(await buscarConfrontosEntre(user.uid, uid, user.uid, 5));
        } else {
          setH2h([]);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [uid, user?.uid, modoAlunoClube]);

  const badges = useMemo(() => {
    if (!perfil) return [];
    return badgesConquistados({
      vitorias: perfil.vitorias,
      derrotas: perfil.derrotas,
      temFoto: Boolean(perfil.fotoUrl),
      temCidade: Boolean(perfil.cidade),
      campeaoTorneio: campeao,
    });
  }, [perfil, campeao]);

  const prob = useMemo(() => {
    if (!perfil || !meuPerfil || !user || user.uid === uid) return null;
    const meus = h2h.filter((c) => c.euVenci).length;
    const deles = h2h.length - meus;
    return calcularProbabilidadeVitoria({
      vitoriasA: meuPerfil.vitorias,
      derrotasA: meuPerfil.derrotas,
      vitoriasB: perfil.vitorias,
      derrotasB: perfil.derrotas,
      nivelA: meuPerfil.nivel,
      nivelB: perfil.nivel,
      h2hA: meus,
      h2hB: deles,
    });
  }, [perfil, meuPerfil, user, uid, h2h]);

  async function mensagem() {
    if (!user || !meuPerfil || !uid || !perfil) return;
    try {
      const id = await abrirOuCriarConversaAmigo({
        uidA: user.uid,
        nomeA: meuPerfil.nome,
        fotoA: meuPerfil.fotoUrl,
        uidB: uid,
        nomeB: perfil.nome,
        fotoB: perfil.fotoUrl,
      });
      router.push(`/chat/${id}`);
    } catch (e: unknown) {
      Alert.alert(
        'Mensagem',
        e instanceof Error ? e.message : 'Não foi possível abrir o chat.'
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.empty}>Jogador não encontrado.</Text>
      </SafeAreaView>
    );
  }

  const souEu = user?.uid === uid;
  const h2hMeus = h2h.filter((c) => c.euVenci).length;
  const h2hDeles = h2h.length - h2hMeus;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {modoAlunoClube ? 'Aluno' : 'Perfil'}
        </Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.top}>
          <Avatar uri={perfil.fotoUrl} nome={perfil.nome} size="xl" verified />
          <Text style={styles.nome}>{perfil.nome}</Text>
          {perfil.cidade ? (
            <Text style={styles.meta}>
              {[perfil.bairro, perfil.cidade, perfil.estado].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {perfil.nivel ? <Text style={styles.meta}>Nível: {perfil.nivel}</Text> : null}
          {perfil.esportes?.length ? (
            <Text style={styles.meta}>
              {perfil.esportes
                .map((idEsp) => ESPORTES.find((e) => e.id === idEsp)?.nome ?? idEsp)
                .join(' · ')}
            </Text>
          ) : null}
        </View>

        {!modoAlunoClube ? (
          <StatsCard vitorias={perfil.vitorias} derrotas={perfil.derrotas} />
        ) : (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>Aluno do clube</Text>
            <Text style={styles.meta}>Contato e dados do aluno.</Text>
          </View>
        )}

        {!modoAlunoClube && !souEu && meuPerfil && prob != null ? (
          <VsCard
            nomeA={meuPerfil.nome}
            fotoA={meuPerfil.fotoUrl}
            nomeB={perfil.nome}
            fotoB={perfil.fotoUrl}
            probabilidadeA={prob}
          />
        ) : null}

        {!modoAlunoClube && !souEu && h2h.length > 0 ? (
          <View style={styles.block}>
            <Text style={styles.blockTitle}>
              H2H · {h2hMeus}–{h2hDeles}
            </Text>
            {h2h.map((c) => (
              <View key={c.id} style={styles.row}>
                <Text style={styles.rowMain}>{c.placar}</Text>
                <Text style={styles.rowSub}>
                  {c.euVenci ? 'Você venceu' : 'Ele(a) venceu'} · {c.dataLabel}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {!modoAlunoClube ? (
          <>
            <View style={styles.tabsRow}>
              {ABAS.map((tab) => {
                const on = aba === tab.id;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tab, on && styles.tabOn]}
                    onPress={() => setAba(tab.id)}
                  >
                    <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {aba === 'feed' ? (
              <View style={styles.block}>
                {posts.length === 0 ? (
                  <Text style={styles.meta}>Nenhum post no feed ainda.</Text>
                ) : (
                  posts.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={styles.feedItem}
                      onPress={() => router.push(`/post/${p.id}`)}
                    >
                      <Text style={styles.rowMain} numberOfLines={4}>
                        {p.texto}
                      </Text>
                      <Text style={styles.rowSub}>
                        {p.tipo === 'resultado' ? 'Resultado' : 'Post'}
                        {p.criadoEm?.seconds
                          ? ` · ${new Date(p.criadoEm.seconds * 1000).toLocaleDateString('pt-BR')}`
                          : ''}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}

            {aba === 'proximos' ? (
              <View style={styles.block}>
                {desafiosAgendados.length === 0 && proximosTorneio.length === 0 ? (
                  <Text style={styles.meta}>Nenhum jogo marcado no momento.</Text>
                ) : (
                  <>
                    {proximosTorneio.map((c) => (
                      <TouchableOpacity
                        key={`${c.torneioId}-${c.id}`}
                        style={styles.row}
                        onPress={() => router.push(c.rota as never)}
                      >
                        <Text style={styles.rowMain} numberOfLines={2}>
                          🏆 {c.j1Nome} vs {c.j2Nome}
                        </Text>
                        <Text style={styles.rowSub}>
                          {c.torneioNome}
                          {c.labelRodada ? ` · ${c.labelRodada}` : ''}
                          {c.dataHoraInicio ? ` · ${c.dataHoraInicio}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {desafiosAgendados.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={styles.row}
                        onPress={() => router.push(`/desafio/${d.id}`)}
                      >
                        <Text style={styles.rowMain}>vs {d.nome}</Text>
                        <Text style={styles.rowSub}>
                          Desafio · {d.quadra}
                          {d.data ? ` · ${d.data}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            ) : null}

            {aba === 'torneios' ? (
              <View style={styles.block}>
                {torneios.length === 0 ? (
                  <Text style={styles.meta}>Não está inscrito em torneios.</Text>
                ) : (
                  torneios.map((t) => (
                    <TouchableOpacity
                      key={t.torneioId}
                      style={styles.row}
                      onPress={() => router.push(t.rota as never)}
                    >
                      <Text style={styles.rowMain}>{t.torneioNome}</Text>
                      <Text style={styles.rowSub}>
                        {t.clubeNome ? `${t.clubeNome} · ` : ''}
                        {t.statusTorneio}
                        {t.statusInscricao ? ` · insc.: ${t.statusInscricao}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            ) : null}

            {aba === 'partidas' ? (
              <View style={styles.block}>
                {partidas.length === 0 ? (
                  <Text style={styles.meta}>Nenhuma partida registrada ainda.</Text>
                ) : (
                  partidas.map((p) => {
                    const adversario =
                      p.jogador1 === uid ? p.jogador2Nome : p.jogador1Nome;
                    const ganhou = p.vencedor === uid;
                    return (
                      <View key={p.id} style={styles.row}>
                        <Text
                          style={[styles.rowMain, ganhou ? styles.win : styles.loss]}
                        >
                          {ganhou ? 'V' : 'D'} · vs {adversario}
                        </Text>
                        <Text style={styles.rowSub}>
                          {p.placar} · {p.tipo || 'jogo'} · {p.dataLabel}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Badges</Text>
              <View style={styles.badgeGrid}>
                {badges.length === 0 ? (
                  <Text style={styles.meta}>Ainda sem conquistas.</Text>
                ) : (
                  badges.map((b) => (
                    <View key={b.id} style={styles.badgeCell}>
                      <Ionicons name={b.icon} size={26} color={Colors.accent} />
                      <Text style={styles.badgeNome}>{b.nome}</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </>
        ) : null}

        {!souEu ? (
          <View style={styles.actions}>
            {!modoAlunoClube ? (
              <Button
                label="Convidar para jogar"
                onPress={() =>
                  router.push({
                    pathname: '/desafio/novo',
                    params: { desafiadoUid: uid },
                  })
                }
              />
            ) : null}
            <Button
              label="Mensagem no app"
              variant="outline"
              onPress={() => void mensagem()}
            />
            {perfil.telefone ? (
              <Button
                label="WhatsApp"
                variant="outline"
                onPress={() =>
                  void abrirWhatsApp(
                    perfil.telefone,
                    modoAlunoClube
                      ? `Olá ${perfil.nome}! Aqui é o clube no Rally Up.`
                      : `Olá ${perfil.nome}! Vi seu perfil no Rally Up. Bora marcar um jogo?`
                  )
                }
              />
            ) : null}
          </View>
        ) : null}
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 16, paddingBottom: 40, gap: 14 },
  top: { alignItems: 'center', gap: 6, marginBottom: 4 },
  nome: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  meta: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  block: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  blockTitle: { color: Colors.accent, fontWeight: '800', fontSize: 14 },
  row: { gap: 2, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' },
  rowMain: { color: Colors.textPrimary, fontWeight: '700', fontSize: 14 },
  rowSub: { color: Colors.textSecondary, fontSize: 12 },
  win: { color: Colors.accent },
  loss: { color: Colors.danger },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeCell: { width: '30%', alignItems: 'center', gap: 4 },
  badgeNome: { color: Colors.textPrimary, fontSize: 11, textAlign: 'center', fontWeight: '600' },
  actions: { gap: 10, marginTop: 8 },
  tabsRow: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: Colors.accent },
  tabTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 11 },
  tabTxtOn: { color: Colors.textOnAccent },
  feedItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 4,
  },
});
