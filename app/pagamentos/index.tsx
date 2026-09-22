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
import { pagarComEscolhaDeMeio } from '../../utils/checkoutComMeio';
import { formatMoneyBR } from '../../utils/mascaras';
import type { PagamentoDoc } from '../../types/pagamento';

type FiltroPeriodo = 'mes' | '3meses' | 'todos' | 'pendentes';

function criadoMs(p: PagamentoDoc): number {
  return (p.criadoEm?.seconds ?? 0) * 1000;
}

function noMesAtual(ms: number): boolean {
  if (!ms) return true; // sem data → mostra no mês (cobranças recentes)
  const d = new Date(ms);
  const agora = new Date();
  return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth();
}

function nosUltimosMeses(ms: number, n: number): boolean {
  if (!ms) return true;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - n);
  return ms >= limite.getTime();
}

export default function MeusPagamentosScreen() {
  const router = useRouter();
  const { clubeId } = useLocalSearchParams<{ clubeId?: string }>();
  const { perfil } = useAuth();
  const { pagamentos, loading } = useMeusPagamentos();
  const [paying, setPaying] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroPeriodo>('mes');

  const base = useMemo(
    () => (clubeId ? pagamentos.filter((p) => p.clubeId === clubeId) : pagamentos),
    [pagamentos, clubeId]
  );

  const lista = useMemo(() => {
    const sorted = [...base].sort((a, b) => criadoMs(b) - criadoMs(a));
    return sorted.filter((p) => {
      const ms = criadoMs(p);
      if (filtro === 'mes') return noMesAtual(ms);
      if (filtro === '3meses') return nosUltimosMeses(ms, 3);
      if (filtro === 'pendentes') {
        return (
          p.status === 'aguardando_pagamento' ||
          p.status === 'pendente' ||
          p.status === 'atrasado' ||
          p.status === 'recusado'
        );
      }
      return true;
    });
  }, [base, filtro]);

  function irTorneios() {
    router.replace({ pathname: '/(tabs)/trofeu', params: { aba: 'torneios' } });
  }

  async function pagar(p: PagamentoDoc) {
    setPaying(p.id);
    try {
      const r = await pagarComEscolhaDeMeio({
        pagamentoId: p.id,
        titulo: `${p.tipo} · ${p.clubeNome}`,
        ciclo: p.ciclo,
        regras: {
          valor: p.valorBase ?? p.valor,
          permitePix: true,
          permiteCartao: true,
          descontoPixPercent:
            p.descontoPercent && p.meioPagamento === 'pix' ? p.descontoPercent : undefined,
          descontoCartaoPercent:
            p.descontoPercent && p.meioPagamento === 'cartao'
              ? p.descontoPercent
              : undefined,
          ciclo: p.ciclo,
        },
      });
      if (r === 'abortado') {
        /* usuário cancelou o alerta de meio */
      } else if (r === 'cancelado') {
        Alert.alert(
          'Pagamento',
          'Checkout fechado. Se você concluiu o pagamento, o status atualiza em instantes. Senão, toque em Pagar outra vez.'
        );
      } else if (r === 'aprovado') {
        Alert.alert('Pagamento', 'Pagamento confirmado!', [
          { text: 'Ver torneios', onPress: irTorneios },
        ]);
        irTorneios();
      } else {
        Alert.alert(
          'Pagamento',
          'Se pagou com PIX/cartão, o status atualiza em instantes via Stripe.',
          [{ text: 'Ver torneios', onPress: irTorneios }]
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

  const chips: { id: FiltroPeriodo; label: string }[] = [
    { id: 'mes', label: 'Este mês' },
    { id: '3meses', label: '3 meses' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'todos', label: 'Todos' },
  ];

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
          <Text style={styles.idLabel}>Seu ID Rally Up</Text>
          <Text style={styles.idValue}>{perfil.setmatchId}</Text>
          <Text style={styles.idHint}>Passe este ID ao clube para virar aluno / ranking.</Text>
        </View>
      ) : null}

      <View style={styles.filtros}>
        {chips.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, filtro === c.id && styles.chipOn]}
            onPress={() => setFiltro(c.id)}
          >
            <Text style={[styles.chipTxt, filtro === c.id && styles.chipTxtOn]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {filtro === 'mes'
                ? 'Nenhum pagamento neste mês. Use o filtro para ver mais.'
                : 'Nenhuma cobrança neste filtro.'}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.nome}>
                {item.tipo.toUpperCase()} · {item.clubeNome}
              </Text>
              <Text style={styles.meta}>
                {formatMoneyBR(item.valor)} ·{' '}
                {item.ciclo === 'mensal'
                  ? 'mensal (cartão = recorrente)'
                  : 'pagamento único'}{' '}
                · {item.status}
              </Text>
              {item.torneioNome || item.rankingNome || item.aulaTitulo ? (
                <Text style={styles.meta}>
                  {item.torneioNome || item.rankingNome || item.aulaTitulo}
                </Text>
              ) : null}
              {podePagar(item.status) ? (
                <Button
                  label={
                    paying === item.id
                      ? 'Abrindo…'
                      : item.ciclo === 'mensal'
                        ? 'Pagar (cartão recorrente ou PIX)'
                        : 'Pagar (PIX / cartão)'
                  }
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
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13 },
  chipTxtOn: { color: Colors.textOnAccent },
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
