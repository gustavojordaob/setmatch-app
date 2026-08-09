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
import { calcularProbabilidadeVitoria } from '../../utils/probabilidade';
import type { UsuarioPerfil } from '../../contexts/AuthContext';

export default function JogadorScreen() {
  const { uid, contexto } = useLocalSearchParams<{
    uid: string;
    contexto?: string;
  }>();
  const router = useRouter();
  const { user, perfil: meuPerfil } = useAuth();
  /** Vista clube → aluno: sem VS / H2H / convite competitivo. */
  const modoAlunoClube = contexto === 'aluno_clube';
  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [partidas, setPartidas] = useState<PartidaResumo[]>([]);
  const [h2h, setH2h] = useState<ConfrontoResumo[]>([]);
  const [campeao, setCampeao] = useState(false);

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
        const [hist, camp] = await Promise.all([
          listarPartidasDoJogador(uid, 10),
          jogadorFoiCampeao(uid),
        ]);
        setPartidas(hist);
        setCampeao(camp);
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
          {perfil.idade ? <Text style={styles.meta}>{perfil.idade} anos</Text> : null}
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
            <Text style={styles.meta}>
              Contato e dados do aluno — sem confronto competitivo.
            </Text>
            {perfil.setmatchId ? (
              <Text style={styles.meta}>ID: {perfil.setmatchId}</Text>
            ) : null}
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
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Últimas partidas</Text>
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
                      ? `Olá ${perfil.nome}! Aqui é o clube no Setmatch.`
                      : `Olá ${perfil.nome}! Vi seu perfil no Setmatch. Bora marcar um jogo?`
                  )
                }
              />
            ) : null}
          </View>
        ) : (
          <Button label="Editar meu perfil" onPress={() => router.push('/perfil/editar')} />
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
  headerTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  body: { padding: 20, gap: 16, paddingBottom: 40 },
  top: { alignItems: 'center', gap: 8 },
  nome: { color: Colors.textPrimary, fontSize: 26, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, textAlign: 'center' },
  actions: { gap: 12, marginTop: 8 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  block: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  blockTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: 15 },
  row: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ffffff22' },
  rowMain: { color: Colors.textPrimary, fontWeight: '700' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  win: { color: Colors.accent },
  loss: { color: Colors.textSecondary },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  badgeCell: {
    width: '30%',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  badgeNome: {
    color: Colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
