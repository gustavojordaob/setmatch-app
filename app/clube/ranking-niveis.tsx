import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Button } from '../../components/ui/Button';
import { ButtonFooter } from '../../components/ui/ButtonFooter';
import { useAuth } from '../../hooks/useAuth';
import { useClassificacao } from '../../hooks/useRankings';
import {
  aplicarMovimentacaoRanking,
  colocarUsuarioNoNivel,
  moverJogadorNivel,
  previewMovimentacaoRanking,
  salvarNiveisRanking,
  type MovimentacaoItem,
} from '../../services/rankingNiveis';
import { buscarJogadoresAvancado, type JogadorBusca } from '../../services/buscaJogadores';
import {
  niveisPadraoABC,
  niveisPadraoNumerico,
  normalizarNiveisConfig,
  type RankingNivel,
  type RankingNiveisConfig,
} from '../../types/ranking';

export default function RankingNiveisScreen() {
  const { rankingId } = useLocalSearchParams<{ rankingId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { rows } = useClassificacao(rankingId ?? null);

  const [nome, setNome] = useState('');
  const [ativo, setAtivo] = useState(false);
  const [autoAtivo, setAutoAtivo] = useState(true);
  const [autoDiaMes, setAutoDiaMes] = useState('1');
  const [niveis, setNiveis] = useState<RankingNivel[]>(niveisPadraoABC());
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MovimentacaoItem[] | null>(null);
  const [nivelFiltro, setNivelFiltro] = useState<string | null>(null);
  const [buscaTxt, setBuscaTxt] = useState('');
  const [buscaResults, setBuscaResults] = useState<JogadorBusca[]>([]);
  const [nivelColocar, setNivelColocar] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const carregar = useCallback(async () => {
    if (!rankingId) return;
    const snap = await getDoc(doc(db, 'rankings', rankingId));
    if (!snap.exists()) return;
    const raw = snap.data();
    if (user && raw.donoUid !== user.uid) {
      Alert.alert('Ranking', 'Só o dono pode gerenciar níveis.');
      router.back();
      return;
    }
    setNome(String(raw.nome ?? ''));
    const cfg = normalizarNiveisConfig(raw.niveis as RankingNiveisConfig | undefined);
    setAtivo(cfg.ativo);
    setAutoAtivo(cfg.autoAtivo);
    setAutoDiaMes(String(cfg.autoDiaMes));
    setNiveis(cfg.niveis.length >= 2 ? cfg.niveis : niveisPadraoABC());
    if (cfg.niveis[0]) setNivelColocar(cfg.niveis[0].id);
  }, [rankingId, user, router]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const niveisOrdenados = useMemo(
    () => [...niveis].sort((a, b) => a.ordem - b.ordem),
    [niveis]
  );

  function patchNivel(id: string, patch: Partial<RankingNivel>) {
    setNiveis((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }

  function addNivel() {
    const ordem = niveis.length;
    const id = `n${Date.now().toString(36)}`;
    setNiveis((prev) => [
      ...prev,
      { id, nome: String(ordem + 1), ordem, sobeQuantos: 3, caiQuantos: 3 },
    ]);
  }

  function removeNivel(id: string) {
    if (niveis.length <= 2) {
      Alert.alert('Níveis', 'Mantenha pelo menos 2 níveis.');
      return;
    }
    setNiveis((prev) =>
      prev
        .filter((n) => n.id !== id)
        .map((n, i) => ({ ...n, ordem: i }))
    );
  }

  async function persistConfig(): Promise<void> {
    if (!rankingId) return;
    const cfg: RankingNiveisConfig = {
      ativo,
      autoAtivo,
      autoDiaMes: Math.min(28, Math.max(1, parseInt(autoDiaMes, 10) || 1)),
      niveis: niveisOrdenados.map((n, i) => ({
        ...n,
        ordem: i,
        sobeQuantos: i === 0 ? 0 : n.sobeQuantos,
        caiQuantos: i === niveisOrdenados.length - 1 ? 0 : n.caiQuantos,
      })),
    };
    await salvarNiveisRanking(rankingId, cfg);
  }

  async function salvar() {
    if (!rankingId) return;
    setLoading(true);
    try {
      await persistConfig();
      Alert.alert('Níveis', 'Configuração salva.');
      setPreview(null);
    } catch (e: unknown) {
      Alert.alert('Níveis', e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  }

  async function verPreview() {
    if (!rankingId) return;
    setLoading(true);
    try {
      await persistConfig();
      const p = await previewMovimentacaoRanking(rankingId);
      setPreview(p.movimentos);
      if (p.movimentos.length === 0) {
        Alert.alert('Rodada', 'Ninguém sobe nem cai com as regras atuais.');
      }
    } catch (e: unknown) {
      Alert.alert('Rodada', e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  async function aplicarRodada(forcar: boolean) {
    if (!rankingId) return;
    Alert.alert(
      'Aplicar sobe/desce',
      forcar
        ? 'Forçar rodada neste mês? Quem mudar de nível terá pontos zerados.'
        : 'Aplicar rodada do mês? Quem mudar de nível terá pontos zerados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aplicar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const r = await aplicarMovimentacaoRanking(rankingId, {
                forcarMes: forcar,
              });
              Alert.alert(
                'Rodada',
                r.aplicados === 0
                  ? 'Nenhuma mudança.'
                  : `${r.aplicados} jogador(es) movimentados.`
              );
              setPreview(null);
            } catch (e: unknown) {
              Alert.alert('Rodada', e instanceof Error ? e.message : 'Erro');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  async function moverManual(uid: string, paraNivelId: string) {
    if (!rankingId) return;
    setLoading(true);
    try {
      await moverJogadorNivel({ rankingId, uid, paraNivelId, zerarPts: false });
      Alert.alert('Nível', 'Jogador movido.');
    } catch (e: unknown) {
      Alert.alert('Nível', e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }

  async function buscarUsuario() {
    const t = buscaTxt.trim();
    if (t.length < 2) {
      Alert.alert('Busca', 'Digite nome ou ID (SM-XXXX).');
      return;
    }
    setBuscando(true);
    try {
      const list = await buscarJogadoresAvancado({ texto: t, max: 15 });
      setBuscaResults(list);
      if (list.length === 0) Alert.alert('Busca', 'Nenhum usuário encontrado.');
    } catch (e: unknown) {
      Alert.alert('Busca', e instanceof Error ? e.message : 'Erro');
    } finally {
      setBuscando(false);
    }
  }

  async function colocarDireto(j: JogadorBusca) {
    if (!rankingId || !nivelColocar) {
      Alert.alert('Nível', 'Escolha o nível de destino.');
      return;
    }
    const nivelNome = niveisOrdenados.find((n) => n.id === nivelColocar)?.nome ?? nivelColocar;
    Alert.alert(
      'Colocar no nível',
      `Colocar ${j.nome} direto no nível ${nivelNome}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Colocar',
          onPress: async () => {
            setLoading(true);
            try {
              await persistConfig();
              const r = await colocarUsuarioNoNivel({
                rankingId,
                uid: j.uid,
                nome: j.nome,
                fotoUrl: j.fotoUrl,
                nivelId: nivelColocar,
              });
              Alert.alert(
                'Pronto',
                r === 'criado'
                  ? `${j.nome} entrou no ranking no nível ${nivelNome}.`
                  : `${j.nome} foi para o nível ${nivelNome}.`
              );
              setBuscaResults([]);
              setBuscaTxt('');
            } catch (e: unknown) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Falha');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  const rowsFiltrados = useMemo(() => {
    if (!nivelFiltro) return rows;
    return rows.filter((r) => (r.nivelId || '') === nivelFiltro);
  }, [rows, nivelFiltro]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Níveis do ranking</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.meta}>{nome}</Text>
        <Text style={styles.hint}>
          Defina categorias (A/B/C ou 1/2/3…). Em cada nível: quantos sobem e quantos caem.
          Rodada automática no dia escolhido + opção de aplicar manualmente.
        </Text>

        <View style={styles.rowSwitch}>
          <Text style={styles.label}>Ativar níveis</Text>
          <Switch
            value={ativo}
            onValueChange={setAtivo}
            trackColor={{ false: Colors.surfaceDark, true: Colors.accent }}
            thumbColor={Colors.textPrimary}
          />
        </View>

        <View style={styles.presets}>
          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => setNiveis(niveisPadraoABC())}
          >
            <Text style={styles.presetTxt}>Preset A · B · C</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetBtn}
            onPress={() => setNiveis(niveisPadraoNumerico(5, 6, 6))}
          >
            <Text style={styles.presetTxt}>Preset 1–5 (6↑↓)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.presetBtn} onPress={addNivel}>
            <Text style={styles.presetTxt}>+ Nível</Text>
          </TouchableOpacity>
        </View>

        {niveisOrdenados.map((n, i) => (
          <View key={n.id} style={styles.card}>
            <View style={styles.cardHead}>
              <TextInput
                style={styles.nomeInput}
                value={n.nome}
                onChangeText={(t) => patchNivel(n.id, { nome: t })}
                placeholder="Nome"
                placeholderTextColor={Colors.textSecondary}
              />
              <TouchableOpacity onPress={() => removeNivel(n.id)}>
                <Ionicons name="trash-outline" size={20} color={Colors.accent} />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardSub}>
              {i === 0 ? 'Topo' : i === niveisOrdenados.length - 1 ? 'Base' : `Nível ${i + 1}`}
            </Text>
            <View style={styles.nums}>
              <View style={styles.numBox}>
                <Text style={styles.numLabel}>Sobem (top)</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="number-pad"
                  editable={i > 0}
                  value={String(i === 0 ? 0 : n.sobeQuantos)}
                  onChangeText={(t) =>
                    patchNivel(n.id, { sobeQuantos: parseInt(t.replace(/\D/g, ''), 10) || 0 })
                  }
                />
              </View>
              <View style={styles.numBox}>
                <Text style={styles.numLabel}>Caem (bottom)</Text>
                <TextInput
                  style={styles.numInput}
                  keyboardType="number-pad"
                  editable={i < niveisOrdenados.length - 1}
                  value={String(i === niveisOrdenados.length - 1 ? 0 : n.caiQuantos)}
                  onChangeText={(t) =>
                    patchNivel(n.id, { caiQuantos: parseInt(t.replace(/\D/g, ''), 10) || 0 })
                  }
                />
              </View>
            </View>
          </View>
        ))}

        <View style={styles.rowSwitch}>
          <Text style={styles.label}>Rodada automática mensal</Text>
          <Switch
            value={autoAtivo}
            onValueChange={setAutoAtivo}
            trackColor={{ false: Colors.surfaceDark, true: Colors.accent }}
            thumbColor={Colors.textPrimary}
          />
        </View>
        <Text style={styles.numLabel}>Dia do mês (1–28)</Text>
        <TextInput
          style={[styles.numInput, { width: 80, marginBottom: 16 }]}
          keyboardType="number-pad"
          value={autoDiaMes}
          onChangeText={setAutoDiaMes}
        />

        <Text style={styles.section}>Rodada sobe/desce</Text>
        <TouchableOpacity style={styles.action} onPress={() => void verPreview()}>
          <Text style={styles.actionTxt}>Ver quem sobe / cai</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => void aplicarRodada(false)}>
          <Text style={styles.actionTxt}>Aplicar rodada do mês</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionGhost} onPress={() => void aplicarRodada(true)}>
          <Text style={styles.actionGhostTxt}>Forçar de novo neste mês</Text>
        </TouchableOpacity>

        {preview && preview.length > 0 ? (
          <View style={styles.previewBox}>
            {preview.map((m) => (
              <Text key={m.uid} style={styles.previewLine}>
                {m.motivo === 'sobe' ? '↑' : '↓'} {m.nome}: {m.deNivelNome} → {m.paraNivelNome}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.section}>Colocar usuário direto num nível</Text>
        <Text style={styles.hint}>
          Busque por nome ou ID (SM-XXXX) e escolha o nível. Se ainda não estiver no ranking, entra direto nessa categoria.
        </Text>
        <TextInput
          style={[styles.numInput, { marginBottom: 8 }]}
          placeholder="Nome ou SM-XXXX"
          placeholderTextColor={Colors.textSecondary}
          value={buscaTxt}
          onChangeText={setBuscaTxt}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={styles.action}
          onPress={() => void buscarUsuario()}
          disabled={buscando}
        >
          <Text style={styles.actionTxt}>{buscando ? 'Buscando…' : 'Buscar usuário'}</Text>
        </TouchableOpacity>
        <Text style={styles.numLabel}>Nível de destino</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          {niveisOrdenados.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.chip, nivelColocar === n.id && styles.chipOn]}
              onPress={() => setNivelColocar(n.id)}
            >
              <Text style={[styles.chipTxt, nivelColocar === n.id && styles.chipTxtOn]}>
                {n.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {buscaResults.map((j) => (
          <View key={j.uid} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerNome}>{j.nome}</Text>
              <Text style={styles.playerMeta}>
                {j.setmatchId ? `${j.setmatchId} · ` : ''}
                {j.cidade || '—'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.action}
              onPress={() => void colocarDireto(j)}
              disabled={loading}
            >
              <Text style={styles.actionTxt}>Colocar</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.section}>Mover jogador (manual)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <TouchableOpacity
            style={[styles.chip, !nivelFiltro && styles.chipOn]}
            onPress={() => setNivelFiltro(null)}
          >
            <Text style={[styles.chipTxt, !nivelFiltro && styles.chipTxtOn]}>Todos</Text>
          </TouchableOpacity>
          {niveisOrdenados.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.chip, nivelFiltro === n.id && styles.chipOn]}
              onPress={() => setNivelFiltro(n.id)}
            >
              <Text style={[styles.chipTxt, nivelFiltro === n.id && styles.chipTxtOn]}>
                {n.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {rowsFiltrados.map((r) => (
          <View key={r.uid} style={styles.playerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.playerNome}>{r.nome}</Text>
              <Text style={styles.playerMeta}>
                Nível {niveisOrdenados.find((n) => n.id === r.nivelId)?.nome ?? '—'} · {r.pts} pts
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {niveisOrdenados.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.moveBtn, r.nivelId === n.id && styles.moveBtnOn]}
                  disabled={r.nivelId === n.id || loading}
                  onPress={() => void moverManual(r.uid, n.id)}
                >
                  <Text
                    style={[styles.moveTxt, r.nivelId === n.id && styles.moveTxtOn]}
                  >
                    {n.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <ButtonFooter>
        <Button label="Salvar níveis" onPress={() => void salvar()} loading={loading} />
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
  body: { paddingHorizontal: 20, paddingBottom: 40 },
  meta: { color: Colors.accent, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  rowSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  presetBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  presetTxt: { color: Colors.accent, fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nomeInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 4,
  },
  cardSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 8 },
  nums: { flexDirection: 'row', gap: 12 },
  numBox: { flex: 1 },
  numLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  numInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  section: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    marginTop: 8,
    marginBottom: 10,
  },
  action: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTxt: { color: Colors.textOnAccent, fontWeight: '800' },
  actionGhost: {
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionGhostTxt: { color: Colors.accent, fontWeight: '700' },
  previewBox: {
    backgroundColor: Colors.surfaceDark,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  previewLine: { color: Colors.textPrimary, fontSize: 13 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipOn: { backgroundColor: Colors.accent },
  chipTxt: { color: Colors.accent, fontWeight: '700' },
  chipTxtOn: { color: Colors.textOnAccent },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  playerNome: { color: Colors.textPrimary, fontWeight: '700' },
  playerMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  moveBtn: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 6,
  },
  moveBtnOn: { backgroundColor: Colors.accent },
  moveTxt: { color: Colors.accent, fontWeight: '700', fontSize: 12 },
  moveTxtOn: { color: Colors.textOnAccent },
});
