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
import { Radius } from '../../constants/radius';
import { useAuth } from '../../hooks/useAuth';
import { listarClubesDoDono } from '../../services/clubes';
import { liberarPagamentoAdmin } from '../../services/pagamentos';
import { usePagamentosDoClube } from '../../hooks/usePagamentos';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import type { PagamentoDoc } from '../../types/pagamento';

export default function FinanceiroClubeScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const [clubeId, setClubeId] = useState<string>();
  const { pagamentos, loading } = usePagamentosDoClube(clubeId);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void listarClubesDoDono(user.uid).then((list) => {
        if (list[0]) setClubeId(list[0].id);
      });
    }, [user])
  );

  async function liberar(p: PagamentoDoc) {
    Alert.alert('Liberar acesso', `Liberar ${p.nome} sem esperar o Mercado Pago?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Liberar',
        onPress: () => void liberarPagamentoAdmin(p.id),
      },
    ]);
  }

  async function msg(p: PagamentoDoc) {
    if (!user || !perfil) return;
    const id = await abrirOuCriarConversaAmigo({
      uidA: user.uid,
      nomeA: perfil.nome,
      uidB: p.uid,
      nomeB: p.nome,
    });
    await enviarMensagem({
      conversaId: id,
      deUid: user.uid,
      deNome: perfil.nome,
      texto: `Sobre seu pagamento (${p.tipo}): status ${p.status}. Qualquer dúvida, fale comigo.`,
    });
    router.push(`/chat/${id}`);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Financeiro</Text>
        <View style={{ width: 26 }} />
      </View>
      <Text style={styles.sub}>Pagamentos Mercado Pago · aulas, rankings e torneios</Text>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={pagamentos}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum pagamento ainda.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome}>
                  {item.nome} · {item.setmatchId}
                </Text>
                <Text style={styles.meta}>
                  {item.tipo.toUpperCase()} · R$ {item.valor.toFixed(2)} · {item.ciclo}
                </Text>
                <Text style={styles.status}>{item.status}</Text>
                {item.torneioNome || item.rankingNome ? (
                  <Text style={styles.meta}>{item.torneioNome || item.rankingNome}</Text>
                ) : null}
              </View>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => void msg(item)}>
                  <Ionicons name="chatbubble-ellipses" size={22} color={Colors.accent} />
                </TouchableOpacity>
                {item.status !== 'aprovado' && item.status !== 'liberado_admin' ? (
                  <TouchableOpacity onPress={() => liberar(item)}>
                    <Ionicons name="checkmark-circle" size={24} color={Colors.accent} />
                  </TouchableOpacity>
                ) : null}
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
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  sub: {
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  status: { color: Colors.accent, fontWeight: '700', marginTop: 4, fontSize: 12 },
  actions: { gap: 12, justifyContent: 'center' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
});
