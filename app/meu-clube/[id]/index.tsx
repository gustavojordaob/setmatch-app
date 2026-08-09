import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../utils/firebaseConfig';
import { Colors } from '../../../constants/colors';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../hooks/useAuth';
import { useMeusPagamentos } from '../../../hooks/usePagamentos';
import { useRankings } from '../../../hooks/useRankings';
import { useMeusClubes } from '../../../hooks/useMeusClubes';
import { abrirOuCriarConversaClube } from '../../../services/mensagens';
import { iniciarCheckoutStripe } from '../../../utils/stripeCheckout';
import { pagarComEscolhaDeMeio } from '../../../utils/checkoutComMeio';
import type { ClubeCompleto } from '../../../services/clubes';
import type { PagamentoDoc } from '../../../types/pagamento';

export default function MeuClubeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, perfil } = useAuth();
  const { pagamentos, loading: loadPag } = useMeusPagamentos();
  const { meus } = useRankings();
  const { matriculas } = useMeusClubes();
  const [clube, setClube] = useState<ClubeCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      const snap = await getDoc(doc(db, 'clubes', id));
      if (snap.exists()) {
        const raw = snap.data();
        setClube({
          id: snap.id,
          nome: String(raw.nome ?? ''),
          cidade: String(raw.cidade ?? ''),
          bairro: raw.bairro ? String(raw.bairro) : undefined,
          telefone: raw.telefone ? String(raw.telefone) : undefined,
          esportes: (raw.esportes as ClubeCompleto['esportes']) ?? ['tenis'],
          donoUid: String(raw.donoUid ?? ''),
          donoNome: String(raw.donoNome ?? ''),
          regrasGerais: raw.regrasGerais ? String(raw.regrasGerais) : undefined,
          aulas: raw.aulas as ClubeCompleto['aulas'],
        });
      }
      setLoading(false);
    })();
  }, [id]);

  const pagsClube = useMemo(
    () => pagamentos.filter((p) => p.clubeId === id),
    [pagamentos, id]
  );
  const rankingsClube = useMemo(() => meus.filter((r) => r.clubeId === id), [meus, id]);
  const matricula = useMemo(
    () => matriculas.find((m) => m.clubeId === id),
    [matriculas, id]
  );

  async function chat() {
    if (!user || !perfil || !clube) return;
    try {
      const conversaId = await abrirOuCriarConversaClube({
        uid: user.uid,
        nome: perfil.nome,
        clubeId: clube.id,
        clubeNome: clube.nome,
        donoUid: clube.donoUid,
      });
      router.push(`/chat/${conversaId}`);
    } catch (e: unknown) {
      Alert.alert(
        'Mensagem',
        e instanceof Error ? e.message : 'Não foi possível abrir o chat.'
      );
    }
  }

  async function pagar(p: PagamentoDoc) {
    setPaying(p.id);
    try {
      if (p.meioPagamento) {
        await iniciarCheckoutStripe({
          pagamentoId: p.id,
          titulo: `${p.tipo} · ${p.clubeNome}`,
          valor: p.valor,
          ciclo: p.ciclo,
          meio: p.meioPagamento,
          permitePix: p.meioPagamento === 'pix',
          permiteCartao: p.meioPagamento === 'cartao',
          descontoPercent: p.descontoPercent,
          valorBase: p.valorBase,
        });
      } else {
        await pagarComEscolhaDeMeio({
          pagamentoId: p.id,
          titulo: `${p.tipo} · ${p.clubeNome}`,
          ciclo: p.ciclo,
          regras: {
            valor: p.valorBase ?? p.valor,
            permitePix: true,
            permiteCartao: true,
            ciclo: p.ciclo,
          },
        });
      }
    } catch (e: unknown) {
      Alert.alert('Pagamento', e instanceof Error ? e.message : 'Falha');
    } finally {
      setPaying(null);
    }
  }

  if (loading || !clube) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {clube.nome}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.meta}>
          {[clube.bairro, clube.cidade].filter(Boolean).join(' · ')}
        </Text>
        {clube.telefone ? <Text style={styles.meta}>Tel: {clube.telefone}</Text> : null}

        {clube.regrasGerais ? (
          <View style={styles.box}>
            <Text style={styles.boxTitle}>Regras do clube</Text>
            <Text style={styles.boxTxt}>{clube.regrasGerais}</Text>
          </View>
        ) : null}

        <View style={styles.box}>
          <Text style={styles.boxTitle}>Aulas (aluno)</Text>
          {matricula ? (
            <Text style={styles.boxTxt}>Status matrícula: {matricula.status}</Text>
          ) : (
            <Text style={styles.boxTxt}>Você ainda não é aluno deste clube.</Text>
          )}
          <Button
            label="Ver modalidades e aulas"
            onPress={() => router.push(`/meu-clube/${id}/aulas`)}
            style={{ marginTop: 10 }}
          />
        </View>

        <Text style={styles.section}>Meus rankings neste clube</Text>
        {rankingsClube.length === 0 ? (
          <Text style={styles.empty}>Nenhum ranking ativo aqui.</Text>
        ) : (
          rankingsClube.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.row}
              onPress={() => router.push(`/ranking/${r.id}`)}
            >
              <Text style={styles.rowTitle}>{r.nome}</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.section}>Pagamentos deste clube</Text>
        {loadPag ? (
          <ActivityIndicator color={Colors.accent} />
        ) : pagsClube.length === 0 ? (
          <Text style={styles.empty}>Nenhuma cobrança deste clube.</Text>
        ) : (
          pagsClube.map((p) => (
            <View key={p.id} style={styles.payCard}>
              <Text style={styles.rowTitle}>
                {p.tipo.toUpperCase()} · R$ {p.valor.toFixed(2)}
              </Text>
              <Text style={styles.meta}>
                {p.ciclo} · {p.status}
              </Text>
              {p.status === 'aguardando_pagamento' ||
              p.status === 'pendente' ||
              p.status === 'atrasado' ? (
                <Button
                  label={paying === p.id ? 'Abrindo…' : 'Pagar agora'}
                  onPress={() => void pagar(p)}
                  loading={paying === p.id}
                  style={{ marginTop: 8 }}
                />
              ) : null}
            </View>
          ))
        )}

        <Button label="Falar com o clube" onPress={() => void chat()} style={{ marginTop: 16 }} />
        <Button
          label="Ver todos os pagamentos"
          variant="outline"
          onPress={() =>
            router.push({ pathname: '/pagamentos', params: { clubeId: id } })
          }
          style={{ marginTop: 10 }}
        />
      </ScrollView>
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
  title: {
    flex: 1,
    textAlign: 'center',
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  body: { padding: 16, paddingBottom: 40 },
  meta: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  box: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginTop: 16,
    gap: 6,
  },
  boxTitle: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 15 },
  boxTxt: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  accent: { color: Colors.accent, fontWeight: '700', marginTop: 4 },
  section: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 22,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  rowTitle: { flex: 1, color: Colors.textPrimary, fontWeight: '600' },
  payCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  empty: { color: Colors.textSecondary, fontSize: 13 },
});
