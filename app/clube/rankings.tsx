import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import {
  FiltroNomeData,
  passaFiltroNomeData,
  toMs,
  type FiltroNomeDataState,
} from '../../components/ui/FiltroNomeData';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import { compartilharRankingFora } from '../../utils/compartilharRanking';
import { db } from '../../utils/firebaseConfig';
import type { EsporteId } from '../../constants/esportes';
import type { Ranking } from '../../types/ranking';

type RankingAdmin = Pick<
  Ranking,
  | 'id'
  | 'nome'
  | 'clubeId'
  | 'clubeNome'
  | 'cidade'
  | 'esporte'
  | 'totalMembros'
  | 'donoUid'
  | 'criadoEm'
>;

export default function MeusRankingsAdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<RankingAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [clubeId, setClubeId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroNomeDataState>({
    nome: '',
    dataDe: '',
    dataAte: '',
  });

  const lista = useMemo(() => {
    return items
      .filter((r) =>
        passaFiltroNomeData({
          nome: r.nome,
          buscaNome: filtro.nome,
          dataMs: toMs(r.criadoEm),
          dataDeTxt: filtro.dataDe,
          dataAteTxt: filtro.dataAte,
        })
      )
      .sort((a, b) => toMs(b.criadoEm) - toMs(a.criadoEm));
  }, [items, filtro]);

  const reload = useCallback(() => {
    if (!user) return;
    setLoading(true);
    void (async () => {
      try {
        const clubes = await listarClubesDoDono(user.uid);
        const cid = clubes[0]?.id ?? null;
        setClubeId(cid);
        const byDono = await getDocs(
          query(collection(db, 'rankings'), where('donoUid', '==', user.uid))
        );
        const map = new Map<string, RankingAdmin>();
        byDono.docs.forEach((d) => {
          const raw = d.data();
          map.set(d.id, {
            id: d.id,
            nome: String(raw.nome ?? ''),
            clubeId: String(raw.clubeId ?? ''),
            clubeNome: String(raw.clubeNome ?? ''),
            cidade: String(raw.cidade ?? ''),
            esporte: (raw.esporte as EsporteId) ?? 'tenis',
            totalMembros: Number(raw.totalMembros ?? 0),
            donoUid: String(raw.donoUid ?? ''),
            criadoEm: raw.criadoEm as { seconds: number } | undefined,
          });
        });
        if (cid) {
          const byClube = await getDocs(
            query(collection(db, 'rankings'), where('clubeId', '==', cid))
          );
          byClube.docs.forEach((d) => {
            if (map.has(d.id)) return;
            const raw = d.data();
            map.set(d.id, {
              id: d.id,
              nome: String(raw.nome ?? ''),
              clubeId: String(raw.clubeId ?? ''),
              clubeNome: String(raw.clubeNome ?? ''),
              cidade: String(raw.cidade ?? ''),
              esporte: (raw.esporte as EsporteId) ?? 'tenis',
              totalMembros: Number(raw.totalMembros ?? 0),
              donoUid: String(raw.donoUid ?? ''),
              criadoEm: raw.criadoEm as { seconds: number } | undefined,
            });
          });
        }
        setItems(
          Array.from(map.values()).sort(
            (a, b) => toMs(b.criadoEm) - toMs(a.criadoEm)
          )
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function onShare(item: RankingAdmin) {
    try {
      await compartilharRankingFora({
        rankingId: item.id,
        nome: item.nome,
        clubeNome: item.clubeNome,
      });
    } catch (e: unknown) {
      Alert.alert('Compartilhar', e instanceof Error ? e.message : 'Falha ao compartilhar.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus rankings</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.hint}>
        Abra para ver a tabela, editar regras/níveis e compartilhar o link do app.
      </Text>

      <FiltroNomeData
        value={filtro}
        onChange={setFiltro}
        nomePlaceholder="Buscar ranking por nome…"
      />

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                {items.length === 0
                  ? 'Nenhum ranking criado ainda.'
                  : 'Nenhum ranking neste filtro.'}
              </Text>
              {items.length === 0 ? (
                <Button
                  label="Criar ranking"
                  onPress={() =>
                    router.push({
                      pathname: '/clube/ranking-novo',
                      params: clubeId ? { clubeId } : {},
                    })
                  }
                />
              ) : null}
            </View>
          }
          ListFooterComponent={
            items.length > 0 ? (
              <Button
                label="Criar novo ranking"
                variant="outline"
                onPress={() =>
                  router.push({
                    pathname: '/clube/ranking-novo',
                    params: clubeId ? { clubeId } : {},
                  })
                }
              />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => router.push(`/ranking/${item.id}`)}
              >
                <Text style={styles.nome}>{item.nome}</Text>
                <Text style={styles.meta}>
                  {item.clubeNome} · {item.cidade}
                </Text>
                <Text style={styles.meta}>
                  {item.esporte} · {item.totalMembros} jogadores
                </Text>
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => void onShare(item)}
                  hitSlop={8}
                >
                  <Ionicons name="share-outline" size={22} color={Colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/clube/ranking-regras',
                      params: { rankingId: item.id },
                    })
                  }
                  hitSlop={8}
                >
                  <Ionicons name="settings-outline" size={22} color={Colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.push(`/ranking/${item.id}`)}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
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
  hint: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  emptyBox: { gap: 16, paddingTop: 24 },
  empty: { color: Colors.textSecondary, textAlign: 'center' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nome: { color: Colors.textPrimary, fontWeight: '800', fontSize: 16 },
  meta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 4 },
});
