import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { DualAvatar } from '../ui/DualAvatar';
import { splitDuplaLabel } from '../../utils/duplaDisplay';

interface PlayerLine {
  nome: string;
  foto?: string | null;
  parceiroNome?: string | null;
  parceiroFoto?: string | null;
  sets: number[];
  winner?: boolean;
}

interface RecentMatchCardProps {
  vitoria?: boolean;
  jogador1: PlayerLine;
  jogador2: PlayerLine;
  data?: string;
  showMeta?: boolean;
}

export function RecentMatchCard({
  vitoria = true,
  jogador1,
  jogador2,
  data,
  showMeta = true,
}: RecentMatchCardProps) {
  return (
    <View style={styles.wrap}>
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
      {showMeta && data ? (
        <View style={styles.meta}>
          <View style={styles.chips}>
            <Text style={styles.chipActive}>🏆</Text>
            <Text style={styles.chip}>🎾</Text>
            <Text style={styles.chip}>📊</Text>
          </View>
          <Text style={styles.date}>{data}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PlayerRow({ nome, foto, parceiroNome, parceiroFoto, sets, winner }: PlayerLine) {
  const split = splitDuplaLabel(nome);
  const nomeB = parceiroNome || split.b;
  const label = nomeB ? `${split.a} / ${nomeB}` : split.a;

  return (
    <View style={styles.row}>
      <DualAvatar
        nomeA={split.a}
        fotoA={foto}
        nomeB={nomeB}
        fotoB={parceiroFoto}
        size="sm"
      />
      <Text style={styles.nome} numberOfLines={2}>
        {label}
      </Text>
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
  wrap: { marginBottom: 8 },
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
  nome: { flex: 1, color: Colors.textPrimary, fontWeight: 'bold', fontSize: 13 },
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
  date: { color: Colors.textMutedDark, fontSize: 12, fontWeight: '600' },
});
