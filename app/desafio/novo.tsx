import { useEffect, useMemo, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useAmigos } from '../../hooks/useAmigos';
import { useEsporte } from '../../contexts/EsporteContext';
import { useClube } from '../../contexts/ClubeContext';
import { ESPORTES } from '../../constants/esportes';
import {
  FORMATOS_PARTIDA,
  type FormatoPartidaId,
} from '../../constants/formatosPartida';
import {
  buscarConfrontosEntre,
  buscarStatsJogador,
  criarDesafio,
  type ConfrontoResumo,
  type StatsJogador,
} from '../../services/desafios';
import { VsCard } from '../../components/jogador/VsCard';
import { calcularProbabilidadeVitoria } from '../../utils/probabilidade';

type AmigoRow = { uid: string; nome: string; fotoUrl?: string };

function winRate(v: number, d: number): string {
  const t = v + d;
  if (t === 0) return '—';
  return `${Math.round((v / t) * 100)}%`;
}

export default function NovoDesafioScreen() {
  const router = useRouter();
  const { desafiadoUid } = useLocalSearchParams<{ desafiadoUid?: string }>();
  const { user, perfil } = useAuth();
  const { esporteAtivo } = useEsporte();
  const { clubeAtivo } = useClube();
  const { amigos } = useAmigos();

  const [selecionado, setSelecionado] = useState<AmigoRow | null>(null);
  const [oponente, setOponente] = useState<StatsJogador | null>(null);
  const [confrontos, setConfrontos] = useState<ConfrontoResumo[]>([]);
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [formato, setFormato] = useState<FormatoPartidaId>('melhor_de_3_stb');
  const [quadra, setQuadra] = useState(clubeAtivo?.nome ? `Quadra · ${clubeAtivo.nome}` : 'A combinar');
  const [dataSugerida, setDataSugerida] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [passo, setPasso] = useState<'rival' | 'setup'>('rival');

  const [fotos, setFotos] = useState<Record<string, string>>({});

  const lista: AmigoRow[] = useMemo(
    () =>
      amigos.map((a) => ({
        uid: a.uid,
        nome: a.nome,
        fotoUrl: a.fotoUrl || fotos[a.uid],
      })),
    [amigos, fotos]
  );

  // Fotos das amizades costumam vir vazias — busca a real de usuarios/{uid}.
  useEffect(() => {
    const faltando = amigos.filter((a) => !a.fotoUrl && fotos[a.uid] === undefined);
    if (faltando.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entradas = await Promise.all(
        faltando.map(async (a) => {
          const s = await buscarStatsJogador(a.uid);
          return [a.uid, s?.fotoUrl ?? ''] as const;
        })
      );
      if (cancelled) return;
      setFotos((prev) => {
        const next = { ...prev };
        for (const [uid, url] of entradas) next[uid] = url;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [amigos, fotos]);

  const esporteMeta = ESPORTES.find((e) => e.id === esporteAtivo);
  const formatoAtual = FORMATOS_PARTIDA.find((f) => f.id === formato)!;

  const h2h = useMemo(() => {
    const meus = confrontos.filter((c) => c.euVenci).length;
    const dele = confrontos.length - meus;
    return { meus, dele };
  }, [confrontos]);

  useEffect(() => {
    if (!desafiadoUid) return;
    const naLista = lista.find((a) => a.uid === desafiadoUid);
    if (naLista) {
      setSelecionado(naLista);
      setPasso('setup');
      return;
    }
    void (async () => {
      const s = await buscarStatsJogador(desafiadoUid);
      if (!s) return;
      setSelecionado({ uid: s.uid, nome: s.nome, fotoUrl: s.fotoUrl });
      setPasso('setup');
    })();
  }, [desafiadoUid, lista]);

  useEffect(() => {
    if (!selecionado || !user) {
      setOponente(null);
      setConfrontos([]);
      return;
    }
    let cancelled = false;
    setLoadingOpp(true);
    void (async () => {
      try {
        const [stats, hist] = await Promise.all([
          buscarStatsJogador(selecionado.uid),
          buscarConfrontosEntre(user.uid, selecionado.uid, user.uid),
        ]);
        if (cancelled) return;
        setOponente(stats);
        setConfrontos(hist);
      } finally {
        if (!cancelled) setLoadingOpp(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selecionado, user]);

  function escolherRival(item: AmigoRow) {
    setSelecionado(item);
    setPasso('setup');
  }

  async function enviar() {
    if (!user || !perfil || !selecionado) {
      Alert.alert('Confronto', 'Escolha um adversário.');
      return;
    }
    setBusy(true);
    try {
      const id = await criarDesafio({
        desafiante: user.uid,
        desafianteNome: perfil.nome,
        desafianteFoto: perfil.fotoUrl,
        desafiado: selecionado.uid,
        desafiadoNome: selecionado.nome,
        desafiadoFoto: oponente?.fotoUrl ?? selecionado.fotoUrl,
        esporte: esporteAtivo,
        quadra,
        clubeId: clubeAtivo?.id,
        clubeNome: clubeAtivo?.nome,
        mensagem,
        formato,
        dataSugerida,
      });
      Alert.alert('Convite enviado!', `Desafio para ${selecionado.nome} está a caminho.`, [
        { text: 'Ver desafio', onPress: () => router.replace(`/desafio/${id}`) },
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Confronto', e instanceof Error ? e.message : 'Falha ao enviar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (passo === 'setup' && !desafiadoUid) {
              setPasso('rival');
              return;
            }
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>
          {passo === 'rival' ? 'Escolher rival' : 'Agendar confronto'}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {passo === 'rival' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>
            Quem você quer desafiar? Escolha um amigo ou abra o perfil de um jogador.
          </Text>
          {lista.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.empty}>
                Sem amigos ainda. Adicione alguém na aba Amigos ou abra o perfil de um jogador e
                toque em Convidar.
              </Text>
              <Button label="Ver amigos" onPress={() => router.push('/(tabs)/amigos')} />
              <Button
                label="Buscar jogadores"
                variant="outline"
                onPress={() => router.push('/buscar')}
              />
            </View>
          ) : (
            lista.map((item) => (
              <TouchableOpacity
                key={item.uid}
                style={styles.amigoRow}
                onPress={() => escolherRival(item)}
              >
                <Avatar uri={item.fotoUrl} nome={item.nome} size="md" />
                <Text style={styles.amigoNome}>{item.nome}</Text>
                <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.esporteBadge}>
            {esporteMeta?.emoji} {esporteMeta?.nome}
            {clubeAtivo ? ` · ${clubeAtivo.nome}` : ''}
          </Text>

          {perfil && oponente ? (
            <VsCard
              nomeA={perfil.nome}
              fotoA={perfil.fotoUrl}
              nomeB={oponente.nome}
              fotoB={oponente.fotoUrl}
              probabilidadeA={calcularProbabilidadeVitoria({
                vitoriasA: perfil.vitorias,
                derrotasA: perfil.derrotas,
                vitoriasB: oponente.vitorias,
                derrotasB: oponente.derrotas,
                nivelA: perfil.nivel,
                nivelB: oponente.nivel,
                h2hA: h2h.meus,
                h2hB: h2h.dele,
              })}
            />
          ) : (
            <View style={styles.vsCard}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          )}

          {confrontos.length > 0 ? (
            <Text style={styles.h2hNew}>
              H2H histórico: {h2h.meus}–{h2h.dele}
            </Text>
          ) : (
            <Text style={styles.h2hNew}>1º confronto direto</Text>
          )}

          {/* Stats comparison */}
          {oponente && perfil ? (
            <View style={styles.statsCard}>
              <Text style={styles.sectionTitle}>Comparativo</Text>
              <StatBar
                label="Win rate"
                left={winRate(perfil.vitorias, perfil.derrotas)}
                right={winRate(oponente.vitorias, oponente.derrotas)}
              />
              <StatBar
                label="Vitórias"
                left={String(perfil.vitorias)}
                right={String(oponente.vitorias)}
              />
              <StatBar
                label="Nível"
                left={perfil.nivel || '—'}
                right={oponente.nivel || '—'}
              />
              {(perfil.cidade || oponente.cidade) && (
                <StatBar
                  label="Cidade"
                  left={perfil.cidade || '—'}
                  right={oponente.cidade || '—'}
                />
              )}
            </View>
          ) : null}

          {/* Head to head */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Últimos confrontos</Text>
            {loadingOpp ? (
              <ActivityIndicator color={Colors.accent} />
            ) : confrontos.length === 0 ? (
              <Text style={styles.muted}>Ainda não jogaram um contra o outro. Hora de começar!</Text>
            ) : (
              confrontos.map((c) => (
                <View key={c.id} style={styles.h2hRow}>
                  <View
                    style={[
                      styles.h2hDot,
                      { backgroundColor: c.euVenci ? Colors.accent : Colors.danger },
                    ]}
                  />
                  <Text style={styles.h2hPlacar}>{c.placar}</Text>
                  <Text style={styles.h2hResult}>
                    {c.euVenci ? 'Você venceu' : 'Rival venceu'}
                  </Text>
                  <Text style={styles.h2hData}>{c.dataLabel}</Text>
                </View>
              ))
            )}
          </View>

          {/* Formato */}
          <Text style={styles.sectionTitle}>Como vai ser a partida?</Text>
          <Text style={styles.formatoDesc}>{formatoAtual.desc}</Text>
          <View style={styles.chipsWrap}>
            {FORMATOS_PARTIDA.map((f) => {
              const on = formato === f.id;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setFormato(f.id)}
                >
                  <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f.short}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.formatoLabel}>{formatoAtual.label}</Text>

          <Text style={styles.fieldLabel}>Local / quadra</Text>
          <TextInput
            style={styles.input}
            value={quadra}
            onChangeText={setQuadra}
            placeholder="Ex: Quadra 2 · Winner"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Quando? (opcional)</Text>
          <TextInput
            style={styles.input}
            value={dataSugerida}
            onChangeText={setDataSugerida}
            placeholder="Ex: Sábado 10h / Domingo à tarde"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={styles.fieldLabel}>Mensagem (opcional)</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={mensagem}
            onChangeText={setMensagem}
            placeholder="Bora marcar? Trago as bolinhas."
            placeholderTextColor={Colors.textSecondary}
            multiline
          />

          <Button
            label="Enviar desafio"
            onPress={() => void enviar()}
            loading={busy}
            disabled={!selecionado}
            style={{ marginTop: 20, marginBottom: 24 }}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatBar({
  label,
  left,
  right,
}: {
  label: string;
  left: string;
  right: string;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLeft} numberOfLines={1}>
        {left}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statRight} numberOfLines={1}>
        {right}
      </Text>
    </View>
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
    marginBottom: 4,
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 17 },
  body: { padding: 16, paddingBottom: 40 },
  intro: { color: Colors.textSecondary, marginBottom: 16, lineHeight: 20 },
  amigoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  amigoNome: { flex: 1, color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  emptyBox: { alignItems: 'center', gap: 14, marginTop: 40, paddingHorizontal: 12 },
  empty: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  vsCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: 'rgba(199,217,65,0.35)',
    overflow: 'hidden',
  },
  esporteBadge: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  vsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerCol: { flex: 1, alignItems: 'center', gap: 6 },
  playerName: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    marginTop: 4,
  },
  playerStat: { color: Colors.textSecondary, fontSize: 12 },
  vsMid: { alignItems: 'center', paddingHorizontal: 8 },
  vsText: {
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 28,
    letterSpacing: 2,
  },
  h2hScore: { color: Colors.white, fontWeight: 'bold', fontSize: 14, marginTop: 4 },
  h2hNew: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },

  statsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  sectionBlock: { marginBottom: 18 },
  sectionTitle: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 10,
  },
  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  statLeft: { flex: 1, color: Colors.accent, fontWeight: '700', fontSize: 13 },
  statLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statRight: {
    flex: 1,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'right',
  },

  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  h2hDot: { width: 8, height: 8, borderRadius: 4 },
  h2hPlacar: { color: Colors.textPrimary, fontWeight: '700', minWidth: 70 },
  h2hResult: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  h2hData: { color: Colors.textSecondary, fontSize: 11 },

  formatoDesc: { color: Colors.textSecondary, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  chipTxtOn: { color: Colors.textOnAccent },
  formatoLabel: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 14,
  },

  fieldLabel: {
    color: Colors.textPrimary,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 16,
    marginBottom: 4,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
});
