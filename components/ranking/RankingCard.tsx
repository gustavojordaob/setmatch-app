import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export type RankingRow = {
  id: string;
  nome: string;
  pts: number;
};

type Props = {
  title: string;
  rows: RankingRow[];
  pinned?: boolean;
  badge?: string;
  onVerMais?: () => void;
};

export function RankingCard({ title, rows, pinned, badge, onVerMais }: Props) {
  return (
    <View style={styles.card}>
      {pinned ? (
        <View style={styles.fixado}>
          <Text style={styles.fixadoTxt}>FIXADO</Text>
        </View>
      ) : null}

      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.ptsHead}>PTS</Text>
      </View>

      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.namePill}>
            <Text style={styles.nameTxt} numberOfLines={1}>
              {r.nome}
            </Text>
          </View>
          <View style={styles.line} />
          <Text style={styles.pts}>{r.pts}</Text>
        </View>
      ))}

      <TouchableOpacity onPress={onVerMais} style={styles.verMais}>
        <Text style={styles.verMaisTxt}>+ver mais</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    marginBottom: 20,
    position: 'relative',
  },
  fixado: {
    position: 'absolute',
    top: -10,
    left: 16,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  fixadoTxt: {
    color: Colors.textOnAccent,
    fontSize: 10,
    fontWeight: 'bold',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: 'bold' },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: { color: Colors.white, fontSize: 10, fontWeight: 'bold' },
  ptsHead: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  namePill: {
    backgroundColor: Colors.pillMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 100,
  },
  nameTxt: { color: Colors.textOnAccent, fontSize: 12, fontWeight: '600' },
  line: { flex: 1, height: 1, backgroundColor: Colors.white, opacity: 0.85 },
  pts: { color: Colors.textPrimary, fontWeight: '600', fontSize: 13, minWidth: 32, textAlign: 'right' },
  verMais: { alignItems: 'center', paddingTop: 4 },
  verMaisTxt: { color: Colors.textPrimary, fontSize: 12 },
});
