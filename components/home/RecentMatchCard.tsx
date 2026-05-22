import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';

interface PlayerLine {
  nome: string;
  sets: number[];
  winner?: boolean;
}

interface RecentMatchCardProps {
  vitoria?: boolean;
  jogador1: PlayerLine;
  jogador2: PlayerLine;
  data: string;
}

export function RecentMatchCard({
  vitoria = true,
  jogador1,
  jogador2,
  data,
}: RecentMatchCardProps) {
  return (
    <View>
      <View style={styles.card}>
        {vitoria ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>Vitória</Text>
          </View>
        ) : null}
        <PlayerRow {...jogador1} />
        <View style={styles.divider} />
        <PlayerRow {...jogador2} />
      </View>
      <View style={styles.meta}>
        <View style={styles.chips}>
          <Text style={styles.chipActive}>🏆</Text>
          <Text style={styles.chip}>🎾</Text>
          <Text style={styles.chip}>📊</Text>
        </View>
        <Text style={styles.date}>{data}</Text>
      </View>
    </View>
  );
}

function PlayerRow({ nome, sets, winner }: PlayerLine) {
  return (
    <View style={styles.row}>
      <Avatar nome={nome} size="sm" />
      <Text style={styles.nome}>{nome}</Text>
      <View style={styles.sets}>
        {sets.map((s, i) =>
          winner ? (
            <View key={i} style={styles.setCircle}>
              <Text style={styles.setCircleTxt}>{s}</Text>
            </View>
          ) : (
            <Text key={i} style={styles.setPlain}>
              {s}
            </Text>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeTxt: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nome: { flex: 1, color: Colors.textPrimary, fontWeight: 'bold' },
  sets: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  setCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCircleTxt: { color: Colors.textOnAccent, fontWeight: 'bold', fontSize: 13 },
  setPlain: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15, minWidth: 20, textAlign: 'center' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chips: { flexDirection: 'row', gap: 8 },
  chipActive: { fontSize: 18 },
  chip: { fontSize: 18, opacity: 0.4 },
  date: { color: '#888', fontSize: 12, fontWeight: '600' },
});
