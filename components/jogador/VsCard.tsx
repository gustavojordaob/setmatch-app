import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';

export interface VsCardProps {
  nomeA: string;
  fotoA?: string | null;
  nomeB: string;
  fotoB?: string | null;
  probabilidadeA: number;
}

export function VsCard({ nomeA, fotoA, nomeB, fotoB, probabilidadeA }: VsCardProps) {
  const probB = 100 - probabilidadeA;

  return (
    <Card variant="green">
      <View style={styles.row}>
        <View style={styles.side}>
          <Avatar uri={fotoA} nome={nomeA} size="lg" />
          <Text style={styles.nome} numberOfLines={1}>
            {nomeA}
          </Text>
        </View>

        <View style={styles.center}>
          <Text style={styles.vs}>VS</Text>
          <View style={styles.probBox}>
            <Text style={styles.probValue}>{probabilidadeA}%</Text>
            <Text style={styles.probLabel}>chance de vitória</Text>
          </View>
        </View>

        <View style={styles.side}>
          <Avatar uri={fotoB} nome={nomeB} size="lg" />
          <Text style={styles.nome} numberOfLines={1}>
            {nomeB}
          </Text>
        </View>
      </View>

      <View style={styles.barRow}>
        <View style={[styles.barA, { flex: probabilidadeA }]} />
        <View style={[styles.barB, { flex: probB }]} />
      </View>
      <Text style={styles.barLegend}>
        {nomeA.split(' ')[0]} {probabilidadeA}% · {nomeB.split(' ')[0]} {probB}%
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  side: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    minWidth: 88,
  },
  nome: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  vs: {
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 1,
  },
  probBox: {
    marginTop: 6,
    alignItems: 'center',
  },
  probValue: {
    ...Typography.score,
    color: Colors.accent,
    fontSize: 20,
  },
  probLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  barRow: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 16,
    backgroundColor: Colors.surface,
  },
  barA: {
    backgroundColor: Colors.accent,
  },
  barB: {
    backgroundColor: Colors.border,
  },
  barLegend: {
    marginTop: 8,
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
