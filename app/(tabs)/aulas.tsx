import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { doc, getDoc } from 'firebase/firestore';
import { Colors, InputColors } from '../../constants/colors';
import { ESPORTES } from '../../constants/esportes';
import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
import { Avatar } from '../../components/ui/Avatar';
import { EsporteSwitcher } from '../../components/EsporteSwitcher';
import { useEsporte } from '../../contexts/EsporteContext';
import { useMeusClubes } from '../../hooks/useMeusClubes';
import { db } from '../../utils/firebaseConfig';
import {
  agruparCursosPorProfessor,
  listarAulasPorModo,
  type AulaPublicada,
  type CursoProfessorResumo,
  type ModoAula,
} from '../../services/aulasPublicadas';

export default function AulasScreen() {
  const router = useRouter();
  const { esporteAtivo } = useEsporte();
  const { clubes, matriculas, loading: loadingClubes } = useMeusClubes();
  const [modo, setModo] = useState<ModoAula>('online');
  const [aulas, setAulas] = useState<AulaPublicada[]>([]);
  const [cursos, setCursos] = useState<CursoProfessorResumo[]>([]);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);

  const esporteNome =
    ESPORTES.find((e) => e.id === esporteAtivo)?.nome ?? esporteAtivo;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listarAulasPorModo(modo, esporteAtivo);
      setAulas(list);
      if (modo === 'online') {
        const grupos = agruparCursosPorProfessor(list);
        const comFoto = await Promise.all(
          grupos.map(async (g) => {
            try {
              const snap = await getDoc(doc(db, 'usuarios', g.donoUid));
              if (snap.exists() && snap.data().fotoUrl) {
                return { ...g, fotoUrl: String(snap.data().fotoUrl) };
              }
            } catch {
              /* ignore */
            }
            return g;
          })
        );
        setCursos(comFoto);
      } else {
        setCursos([]);
      }
    } finally {
      setLoading(false);
    }
  }, [modo, esporteAtivo]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const cursosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return cursos;
    return cursos.filter((c) => c.origemNome.toLowerCase().includes(t));
  }, [cursos, busca]);

  /** Sempre mostra matrículas ativas — não esconde se o filtro de esporte do clube falhar. */
  const minhasMatriculas = useMemo(() => {
    return matriculas.map((m) => {
      const clube = clubes.find((c) => c.id === m.clubeId);
      return {
        ...m,
        nome: clube?.nome || m.clubeNome || 'Clube',
        cidade: clube?.cidade ?? '',
      };
    });
  }, [clubes, matriculas]);

  /** Presencial: agrupa por clube/origem do esporte ativo. */
  const origemPresencial = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        nome: string;
        cidade?: string;
        local?: string;
        valorMensal?: number;
        origemTipo: string;
        aulas: AulaPublicada[];
      }
    >();
    for (const a of aulas) {
      const key = a.origemId || a.donoUid;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nome: a.origemNome,
          cidade: a.cidade,
          local: a.local,
          valorMensal: a.valorMensal,
          origemTipo: a.origemTipo,
          aulas: [],
        });
      }
      map.get(key)!.aulas.push(a);
    }
    const t = busca.trim().toLowerCase();
    let list = Array.from(map.values());
    if (t) {
      list = list.filter(
        (o) =>
          o.nome.toLowerCase().includes(t) ||
          (o.cidade ?? '').toLowerCase().includes(t)
      );
    }
    return list;
  }, [aulas, busca]);

  const descobrirClubes = useMemo(() => {
    const idsMat = new Set(matriculas.map((m) => m.clubeId));
    const idsPub = new Set(origemPresencial.map((o) => o.id));
    return clubes.filter(
      (c) =>
        c.esportes.includes(esporteAtivo) &&
        !idsMat.has(c.id) &&
        !idsPub.has(c.id) &&
        (c.aulas?.ativo || true)
    );
  }, [clubes, matriculas, esporteAtivo, origemPresencial]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="school" size={32} color={Colors.accent} />
        <Text style={styles.title}>AULAS</Text>
      </View>

      <View style={styles.switcherWrap}>
        <EsporteSwitcher variant="chips" />
      </View>

      <View style={styles.toggle}>
        <TouchableOpacity
          style={[styles.toggleBtn, modo === 'online' && styles.toggleOn]}
          onPress={() => setModo('online')}
        >
          <Text style={[styles.toggleTxt, modo === 'online' && styles.toggleTxtOn]}>
            ONLINE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, modo === 'presencial' && styles.toggleOn]}
          onPress={() => setModo('presencial')}
        >
          <Text
            style={[styles.toggleTxt, modo === 'presencial' && styles.toggleTxtOn]}
          >
            PRESENCIAL
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder={
            modo === 'online' ? 'Buscar professor…' : 'Buscar clube ou quadra…'
          }
          placeholderTextColor={InputColors.placeholder}
          value={busca}
          onChangeText={setBusca}
          autoCapitalize="none"
        />
      </View>

      <Text style={styles.esporteHint}>Mostrando {esporteNome}</Text>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_CLEARANCE }}>
        {loading || loadingClubes ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : modo === 'online' ? (
          cursosFiltrados.length === 0 ? (
            <Text style={styles.empty}>
              Nenhum professor com aulas online de {esporteNome} ainda.
            </Text>
          ) : (
            cursosFiltrados.map((c) => (
              <TouchableOpacity
                key={c.donoUid}
                style={styles.profCard}
                onPress={() =>
                  router.push({
                    pathname: '/aula/curso/[donoUid]',
                    params: { donoUid: c.donoUid, esporte: esporteAtivo },
                  })
                }
              >
                <Avatar uri={c.fotoUrl} nome={c.origemNome} size="lg" />
                <View style={styles.profBody}>
                  <Text style={styles.profNome}>{c.origemNome}</Text>
                  <Text style={styles.profMeta}>
                    {ESPORTES.find((e) => e.id === c.esporte)?.nome ?? c.esporte}
                    {' · '}
                    {c.totalModulos} módulo{c.totalModulos === 1 ? '' : 's'}
                    {' · '}
                    {c.totalAulas} aula{c.totalAulas === 1 ? '' : 's'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
              </TouchableOpacity>
            ))
          )
        ) : (
          <>
            <Text style={styles.section}>Minhas aulas presenciais</Text>
            {minhasMatriculas.length === 0 ? (
              <Text style={styles.emptySmall}>
                Você ainda não está matriculado. Peça ao clube para cadastrar seu ID Setmatch.
              </Text>
            ) : (
              minhasMatriculas.map((m) => (
                <TouchableOpacity
                  key={m.id || m.clubeId}
                  style={styles.card}
                  onPress={() => router.push(`/meu-clube/${m.clubeId}/aulas`)}
                >
                  <Text style={styles.cardTitle}>{m.nome}</Text>
                  <Text style={styles.cardSub}>
                    {[m.cidade, m.modalidadeNome, m.status]
                      .filter(Boolean)
                      .join(' · ')}
                    {m.valorFinal != null
                      ? ` · R$ ${Number(m.valorFinal).toFixed(2)}/mês`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={[styles.section, { marginTop: 24 }]}>
              Clubes e quadras · {esporteNome}
            </Text>
            {origemPresencial.length === 0 && descobrirClubes.length === 0 ? (
              <Text style={styles.emptySmall}>
                Nenhum clube/quadra de {esporteNome} por perto na lista.
              </Text>
            ) : null}

            {origemPresencial.map((o) => (
              <TouchableOpacity
                key={o.id}
                style={styles.card}
                onPress={() => {
                  if (o.origemTipo === 'clube') {
                    router.push(`/meu-clube/${o.id}/aulas`);
                  } else if (o.aulas[0]) {
                    router.push({
                      pathname: '/aula/[id]',
                      params: { id: o.aulas[0].id },
                    });
                  }
                }}
              >
                <View style={styles.cardIconRow}>
                  <View style={styles.iconBox}>
                    <Ionicons name="location" size={20} color={Colors.textOnAccent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{o.nome}</Text>
                    <Text style={styles.cardSub}>
                      {[o.cidade, o.local].filter(Boolean).join(' · ') || 'Presencial'}
                      {o.valorMensal
                        ? ` · R$ ${o.valorMensal.toFixed(2)}/mês`
                        : ''}
                      {` · ${o.aulas.length} modalidade${o.aulas.length === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
                </View>
              </TouchableOpacity>
            ))}

            {descobrirClubes.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.card}
                onPress={() => router.push(`/meu-clube/${c.id}/aulas`)}
              >
                <Text style={styles.cardTitle}>{c.nome}</Text>
                <Text style={styles.cardSub}>
                  {c.cidade}
                  {c.aulas?.valorMensal
                    ? ` · R$ ${c.aulas.valorMensal.toFixed(2)}/mês`
                    : ''}
                </Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.linkPag}
              onPress={() => router.push('/pagamentos')}
            >
              <Text style={styles.linkPagTxt}>Meus pagamentos de aulas</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
            </TouchableOpacity>
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
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { color: Colors.accent, fontSize: 36, fontWeight: '900' },
  switcherWrap: { paddingHorizontal: 12, marginTop: 8 },
  toggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 60,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 60,
    alignItems: 'center',
  },
  toggleOn: { backgroundColor: Colors.accent },
  toggleTxt: { color: Colors.textPrimary, fontWeight: '800', fontSize: 13 },
  toggleTxtOn: { color: Colors.textOnAccent },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: 15, padding: 0 },
  esporteHint: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 20,
    marginTop: 8,
  },
  profCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  profBody: { flex: 1 },
  profNome: { color: Colors.textPrimary, fontWeight: '800', fontSize: 17 },
  profMeta: { color: Colors.textSecondary, marginTop: 4, fontSize: 13 },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18, marginBottom: 12 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
  emptySmall: { color: Colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  cardSub: { color: Colors.textSecondary, marginTop: 4, fontSize: 13 },
  linkPag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  linkPagTxt: { color: Colors.accent, fontWeight: '700' },
});
