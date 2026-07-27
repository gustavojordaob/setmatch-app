import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useMeusPagamentos } from '../../hooks/usePagamentos';
import { iniciarCheckoutMercadoPago } from '../../utils/mercadoPago';
import type { PagamentoDoc } from '../../types/pagamento';

export default function MeusPagamentosScreen() {
  const router = useRouter();
  const { clubeId } = useLocalSearchParams<{ clubeId?: string }>();
  const { perfil } = useAuth();
  const { pagamentos, loading } = useMeusPagamentos();
  const [paying, setPaying] = useState<string | null>(null);

  const lista = useMemo(
    () => (clubeId ? pagamentos.filter((p) => p.clubeId === clubeId) : pagamentos),
    [pagamentos, clubeId]
  );

  async function pagar(p: PagamentoDoc) {
    setPaying(p.id);
    try {
      const r = await iniciarCheckoutMercadoPago({
        pagamentoId: p.id,
        titulo: `${p.tipo} · ${p.clubeNome}`,
        valor: p.valor,
        ciclo: p.ciclo,
        permitePix: true,
        permiteCartao: true,
      });
      if (r === 'cancelado') {
        Alert.alert('Pagamento', 'Checkout fechado. Você pode tentar de novo.');
      } else {
        Alert.alert(
          'Pagamento',
          'Se pagou com PIX/cartão, o status atualiza em instantes via Mercado Pago.'
        );
      }
    } catch (e: unknown) {
      Alert.alert('Pagamento', e instanceof Error ? e.message : 'Falha no checkout');
    } finally {
      setPaying(null);
    }
  }

  const podePagar = (s: string) =>
    s === 'aguardando_pagamento' || s === 'pendente' || s === 'atrasado' || s === 'recusado';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>{clubeId ? 'Pagamentos do clube' : 'Meus pagamentos'}</Text>
        <View style={{ width: 26 }} />
      </View>

      {perfil?.setmatchId ? (
        <View style={styles.idBox}>
          <Text style={styles.idLabel}>Seu ID Setmatch</Text>
          <Text style={styles.idValue}>{perfil.setmatchId}</Text>
          <Text style={styles.idHint}>Passe este ID ao clube para virar aluno / ranking.</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.empty}>Você ainda não tem cobranças abertas.</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.nome}>
                {item.tipo.toUpperCase()} · {item.clubeNome}
              </Text>
              <Text style={styles.meta}>
                R$ {item.valor.toFixed(2)} · {item.ciclo} · {item.status}
              </Text>
              {item.torneioNome || item.rankingNome ? (
                <Text style={styles.meta}>{item.torneioNome || item.rankingNome}</Text>
              ) : null}
              {podePagar(item.status) ? (
                <Button
                  label={paying === item.id ? 'Abrindo…' : 'Pagar (PIX / cartão 1x)'}
                  onPress={() => void pagar(item)}
                  loading={paying === item.id}
                  style={{ marginTop: 10 }}
                />
              ) : (
                <Text style={styles.ok}>
                  {item.status === 'aprovado' || item.status === 'liberado_admin'
                    ? 'Acesso liberado'
                    : item.status}
                </Text>
              )}
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
  idBox: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  idLabel: { color: Colors.textSecondary, fontSize: 12 },
  idValue: { color: Colors.accent, fontSize: 22, fontWeight: '900', letterSpacing: 1 },
  idHint: { color: Colors.textSecondary, fontSize: 12 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  ok: { color: Colors.accent, marginTop: 10, fontWeight: '700' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
});
