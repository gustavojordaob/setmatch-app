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
import { useAuth } from '../../hooks/useAuth';
import { liberarPagamentoAdmin } from '../../services/pagamentos';
import { usePagamentosDoDono } from '../../hooks/usePagamentos';
import { listarClubesDoDono, type ClubeCompleto } from '../../services/clubes';
import { abrirOuCriarConversaAmigo, enviarMensagem } from '../../services/mensagens';
import {
  abrirStripeConnectOnboarding,
  atualizarStripeConnectStatus,
} from '../../utils/stripeCheckout';
import type { PagamentoDoc } from '../../types/pagamento';

export default function FinanceiroClubeScreen() {
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { pagamentos, loading } = usePagamentosDoDono(user?.uid);
  const [clube, setClube] = useState<ClubeCompleto | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [stripeLabel, setStripeLabel] = useState('Carregando Stripe…');

  const refreshClube = useCallback(async () => {
    if (!user) return;
    const list = await listarClubesDoDono(user.uid);
    const c = list[0] ?? null;
    setClube(c);
    if (!c) {
      setStripeLabel('Crie um clube para conectar recebimentos.');
      return;
    }
    try {
      const st = await atualizarStripeConnectStatus(c.id);
      if (!st.connected) {
        setStripeLabel('Conta Stripe não conectada — toque para conectar.');
      } else if (st.chargesEnabled) {
        setStripeLabel('Stripe conectado · pronto para receber');
      } else if (st.detailsSubmitted) {
        setStripeLabel('Stripe em análise — aguarde liberação');
      } else {
        setStripeLabel('Onboarding incompleto — toque para continuar');
      }
      const again = await listarClubesDoDono(user.uid);
      setClube(again[0] ?? c);
    } catch {
      setStripeLabel(
        c.stripeChargesEnabled
          ? 'Stripe conectado · pronto para receber'
          : c.stripeAccountId
            ? 'Stripe pendente — toque para continuar'
            : 'Conectar conta Stripe para receber nos pagamentos'
      );
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void refreshClube();
    }, [refreshClube])
  );

  async function conectarStripe() {
    if (!clube) {
      Alert.alert('Stripe', 'Crie um clube antes de conectar a conta.');
      return;
    }
    setStripeBusy(true);
    try {
      await abrirStripeConnectOnboarding(clube.id);
      await refreshClube();
    } catch (e: unknown) {
      Alert.alert('Stripe', e instanceof Error ? e.message : 'Não foi possível conectar.');
    } finally {
      setStripeBusy(false);
    }
  }

  async function liberar(p: PagamentoDoc) {
    Alert.alert('Liberar acesso', `Liberar ${p.nome} sem esperar o Stripe?`, [
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
      fotoA: perfil.fotoUrl,
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
      <Text style={styles.sub}>
        Pagamentos de aulas presenciais, rankings e torneios
      </Text>

      <TouchableOpacity
        style={styles.stripeCard}
        onPress={() => void conectarStripe()}
        disabled={stripeBusy || !clube}
      >
        <Ionicons name="card-outline" size={22} color={Colors.textOnAccent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.stripeTitle}>
            {stripeBusy ? 'Abrindo Stripe…' : 'Recebimentos Stripe'}
          </Text>
          <Text style={styles.stripeSub}>{stripeLabel}</Text>
        </View>
        {stripeBusy ? (
          <ActivityIndicator color={Colors.textOnAccent} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={Colors.textOnAccent} />
        )}
      </TouchableOpacity>

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
                {item.aulaTitulo || item.torneioNome || item.rankingNome ? (
                  <Text style={styles.meta}>
                    {item.aulaTitulo || item.torneioNome || item.rankingNome}
                  </Text>
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
  stripeCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stripeTitle: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 15 },
  stripeSub: { color: Colors.textOnAccent, opacity: 0.85, fontSize: 12, marginTop: 2 },
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
