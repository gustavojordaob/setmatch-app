import { useCallback, useState } from 'react';
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
import { useAuth } from '../../hooks/useAuth';
import { listarTorneiosDoDono, type Torneio } from '../../services/torneios';
import { gerarChaveamento } from '../../services/chaveamentoTorneio';

export default function MeusTorneiosAdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [loading, setLoading] = useState(true);
  const [liberandoId, setLiberandoId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!user) return;
    setLoading(true);
    void listarTorneiosDoDono(user.uid)
      .then(setTorneios)
      .finally(() => setLoading(false));
  }, [user]);

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

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={torneios}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>Nenhum torneio criado ainda.</Text>
              <Button
                label="Criar torneio"
                onPress={() => router.push('/clube/torneio-novo')}
              />
            </View>
          }
          ListFooterComponent={
            torneios.length > 0 ? (
              <Button
                label="Criar novo torneio"
                variant="outline"
                onPress={() => router.push('/clube/torneio-novo')}
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
                  <TouchableOpacity
                    onPress={() => router.push(`/torneio/${item.id}`)}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={Colors.accent}
                    />
                  </TouchableOpacity>
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
