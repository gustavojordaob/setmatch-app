import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../utils/firebaseConfig';
import { Colors } from '../../constants/colors';
import { Avatar } from '../../components/ui/Avatar';
import { useClassificacao } from '../../hooks/useRankings';
import type { Ranking } from '../../types/ranking';
import type { EsporteId } from '../../constants/esportes';
import { resumoPromoCurto, textoCicloPagamento } from '../../utils/checkoutComMeio';

export default function RankingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const { rows, loading } = useClassificacao(id ?? null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const snap = await getDoc(doc(db, 'rankings', id));
      if (snap.exists()) {
        const raw = snap.data();
        setRanking({
          id: snap.id,
          nome: String(raw.nome ?? ''),
          clubeId: String(raw.clubeId ?? ''),
          clubeNome: String(raw.clubeNome ?? ''),
          cidade: String(raw.cidade ?? ''),
          esporte: (raw.esporte as EsporteId) ?? 'tenis',
          donoUid: String(raw.donoUid ?? ''),
          membros: (raw.membros as string[]) ?? [],
          totalMembros: Number(raw.totalMembros ?? 0),
          pagamento: raw.pagamento
            ? {
                ativo: Boolean((raw.pagamento as { ativo?: boolean }).ativo),
                valor: Number((raw.pagamento as { valor?: number }).valor ?? 0),
                ciclo:
                  ((raw.pagamento as { ciclo?: string }).ciclo as 'unico' | 'mensal') ??
                  'mensal',
                regras: String((raw.pagamento as { regras?: string }).regras ?? ''),
                exigeParaEntrar: Boolean(
                  (raw.pagamento as { exigeParaEntrar?: boolean }).exigeParaEntrar
                ),
                permitePix: Boolean(
                  (raw.pagamento as { permitePix?: boolean }).permitePix ?? true
                ),
                permiteCartao: Boolean(
                  (raw.pagamento as { permiteCartao?: boolean }).permiteCartao ?? true
                ),
                descontoPixPercent: Number(
                  (raw.pagamento as { descontoPixPercent?: number }).descontoPixPercent ?? 0
                ),
                descontoCartaoPercent: Number(
                  (raw.pagamento as { descontoCartaoPercent?: number }).descontoCartaoPercent ?? 0
                ),
              }
            : undefined,
        });
      }
    })();
  }, [id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {ranking?.nome ?? 'Ranking'}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {ranking ? (
          <View style={styles.clubeBox}>
            <Ionicons name="trophy" size={28} color={Colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.clubeNome}>{ranking.clubeNome}</Text>
              <Text style={styles.clubeMeta}>
                {ranking.cidade} · {ranking.totalMembros} jogadores
              </Text>
              {ranking.pagamento?.ativo ? (
                <Text style={styles.payMeta}>
                  Taxa R$ {ranking.pagamento.valor.toFixed(2)} ·{' '}
                  {ranking.pagamento.ciclo === 'mensal' ? 'mensal' : 'única'}
                  {`\n${textoCicloPagamento(ranking.pagamento.ciclo)}`}
                  {resumoPromoCurto(ranking.pagamento)
                    ? `\n${resumoPromoCurto(ranking.pagamento)}`
                    : ''}
                  {ranking.pagamento.regras ? `\n${ranking.pagamento.regras}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.tableHead}>
          <Text style={styles.thPos}>#</Text>
          <Text style={styles.thNome}>Jogador</Text>
          <Text style={styles.thStat}>V/D</Text>
          <Text style={styles.thPts}>PTS</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 24 }} />
        ) : rows.length === 0 ? (
          <Text style={styles.empty}>Nenhum jogador no ranking ainda.</Text>
        ) : (
          rows.map((r, i) => (
            <TouchableOpacity
              key={r.uid}
              style={styles.row}
              onPress={() => router.push(`/jogador/${r.uid}`)}
            >
              <Text style={styles.pos}>{i + 1}</Text>
              <View style={styles.nomeWrap}>
                <Avatar uri={r.fotoUrl} nome={r.nome} size="sm" />
                <Text style={styles.nome} numberOfLines={1}>
                  {r.nome}
                </Text>
              </View>
              <Text style={styles.stat}>
                {r.vitorias}/{r.derrotas}
              </Text>
              <Text style={styles.pts}>{r.pts}</Text>
            </TouchableOpacity>
          ))
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  clubeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  clubeNome: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  clubeMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  payMeta: { color: Colors.accent, fontSize: 12, marginTop: 6, lineHeight: 16 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  thPos: { width: 24, color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold' },
  thNome: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', marginLeft: 8 },
  thStat: { width: 48, color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', textAlign: 'center' },
  thPts: { width: 44, color: Colors.textSecondary, fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  pos: { width: 24, color: Colors.accent, fontWeight: 'bold', fontSize: 15 },
  nomeWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
  nome: { flex: 1, color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  stat: { width: 48, color: Colors.textSecondary, fontSize: 13, textAlign: 'center' },
  pts: { width: 44, color: Colors.textPrimary, fontWeight: 'bold', fontSize: 14, textAlign: 'right' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
});
