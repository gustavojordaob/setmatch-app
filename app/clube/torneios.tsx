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
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import {
  FiltroNomeData,
  passaFiltroNomeData,
  toMs,
  type FiltroNomeDataState,
} from '../../components/ui/FiltroNomeData';
import { useAuth } from '../../hooks/useAuth';
import { listarTorneiosDoDono, type Torneio } from '../../services/torneios';
import { gerarChaveamento } from '../../services/chaveamentoTorneio';
import { listarClubesDoDono } from '../../services/clubes';

export default function MeusTorneiosAdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [liberandoId, setLiberandoId] = useState<string | null>(null);
  const [clubeIdPadrao, setClubeIdPadrao] = useState<string | undefined>();
  const [filtro, setFiltro] = useState<FiltroNomeDataState>({
    nome: '',
    dataDe: '',
    dataAte: '',
  });

  const lista = useMemo(() => {
    return torneios
      .filter((t) =>
        passaFiltroNomeData({
          nome: t.nome,
          buscaNome: filtro.nome,
          dataMs: toMs(t.criadoEm) || toMs(t.dataInicio),
          dataDeTxt: filtro.dataDe,
          dataAteTxt: filtro.dataAte,
        })
      )
      .sort((a, b) => {
        const sa = toMs(a.criadoEm) || toMs(a.dataInicio);
        const sb = toMs(b.criadoEm) || toMs(b.dataInicio);
        return sb - sa;
      });
  }, [torneios, filtro]);

  const reload = useCallback(() => {
    if (!user) return;
    setLoading(true);
    void Promise.all([listarTorneiosDoDono(user.uid), listarClubesDoDono(user.uid)])
      .then(([ts, clubes]) => {
        setTorneios(ts);
        setClubeIdPadrao(clubes[0]?.id ?? ts[0]?.clubeId);
      })
      .finally(() => setLoading(false));
  }, [user]);

  function irCriarTorneio() {
    if (clubeIdPadrao) {
      router.push({ pathname: '/clube/torneio-novo', params: { clubeId: clubeIdPadrao } });
    } else {
      router.push('/clube/torneio-novo');
    }
  }

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function liberarChave(item: Torneio) {
    if (!user) return;
    if (item.totalInscritos < 2) {
      Alert.alert(
        'Chaveamento',
        'Precisa de pelo menos 2 inscritos para liberar a chave.'
      );
      return;
    }
    if (item.chaveLiberada || item.status !== 'aberto') {
      router.push(`/torneio/${item.id}`);
      return;
    }
    Alert.alert(
      'Liberar chaveamento',
      `Sortear confrontos de "${item.nome}" e publicar a chave para todos os inscritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar agora',
          onPress: () =>
            void (async () => {
              setLiberandoId(item.id);
              try {
                const n = await gerarChaveamento({
                  torneioId: item.id,
                  donoUid: user.uid,
                  estruturaMata: item.estruturaMata,
                  sortear: item.definicaoChave !== 'manual',
                });
                Alert.alert(
                  'Chave liberada',
                  `${n} jogadores na chave. Os inscritos já podem ver o chaveamento.`
                );
                reload();
                router.push(`/torneio/${item.id}`);
              } catch (e: unknown) {
                Alert.alert(
                  'Chave',
                  e instanceof Error ? e.message : 'Falha ao liberar.'
                );
              } finally {
                setLiberandoId(null);
              }
            })(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Meus torneios</Text>
        <View style={{ width: 26 }} />
      </View>

      <Text style={styles.hint}>
        Abra o torneio para ver inscritos. Quando houver 2+, liberar chaveamento
        sorteia e publica a chave para jogadores e admin.
      </Text>

      <FiltroNomeData
        value={filtro}
        onChange={setFiltro}
        nomePlaceholder="Buscar torneio por nome…"
      />

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>
                {torneios.length === 0
                  ? 'Nenhum torneio criado ainda.'
                  : 'Nenhum torneio neste filtro.'}
              </Text>
              {torneios.length === 0 ? (
                <Button label="Criar torneio" onPress={irCriarTorneio} />
              ) : null}
            </View>
          }
          ListFooterComponent={
            lista.length > 0 || torneios.length > 0 ? (
              <Button
                label="Criar novo torneio"
                variant="outline"
                onPress={irCriarTorneio}
              />
            ) : null
          }
          renderItem={({ item }) => {
            const podeLiberar =
              item.status === 'aberto' &&
              !item.chaveLiberada &&
              item.totalInscritos >= 2;
            return (
              <View style={styles.card}>
                <TouchableOpacity
                  style={{ flex: 1 }}
                  onPress={() => router.push(`/torneio/${item.id}`)}
                >
                  <Text style={styles.nome}>{item.nome}</Text>
                  <Text style={styles.meta}>
                    {item.clubeNome} · {item.cidade}
                  </Text>
                  <Text style={styles.meta}>
                    {item.status} · {item.totalInscritos} inscritos
                    {item.dataInicio ? ` · ${item.dataInicio}` : ''}
                  </Text>
                  {item.chaveLiberada || item.status !== 'aberto' ? (
                    <Text style={styles.chaveOk}>Chave liberada</Text>
                  ) : (
                    <Text style={styles.meta}>
                      Aguardando liberação do chaveamento
                    </Text>
                  )}
                  {item.campeaoNome ? (
                    <Text style={styles.campeao}>🏆 {item.campeaoNome}</Text>
                  ) : null}
                </TouchableOpacity>
                {podeLiberar ? (
                  <Button
                    label="Liberar chave"
                    loading={liberandoId === item.id}
                    onPress={() => liberarChave(item)}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() =>
                        router.push({
                          pathname: '/clube/torneio-editar',
                          params: { id: item.id },
                        })
                      }
                      hitSlop={8}
                    >
                      <Ionicons name="create-outline" size={22} color={Colors.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => router.push(`/torneio/${item.id}`)}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={Colors.accent}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
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
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  hint: {
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  nome: { color: Colors.textPrimary, fontWeight: '800', fontSize: 16 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 3 },
  chaveOk: { color: Colors.accent, fontWeight: '800', marginTop: 4, fontSize: 12 },
  campeao: { color: Colors.accent, fontWeight: '800', marginTop: 4 },
  emptyBox: { gap: 16, marginTop: 24 },
  empty: { color: Colors.textSecondary, textAlign: 'center' },
});
