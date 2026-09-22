import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Card } from '../ui/Card';
import { DualAvatar } from '../ui/DualAvatar';
import { labelDupla, splitDuplaLabel } from '../../utils/duplaDisplay';

export interface VsCardProps {
  nomeA: string;
  fotoA?: string | null;
  nomeA2?: string | null;
  fotoA2?: string | null;
  nomeB: string;
  fotoB?: string | null;
  nomeB2?: string | null;
  fotoB2?: string | null;
  probabilidadeA: number;
}

export function VsCard({
  nomeA,
  fotoA,
  nomeA2,
  fotoA2,
  nomeB,
  fotoB,
  nomeB2,
  fotoB2,
  probabilidadeA,
}: VsCardProps) {
  const probB = 100 - probabilidadeA;
  const splitA = splitDuplaLabel(nomeA);
  const splitB = splitDuplaLabel(nomeB);
  const partnerA = nomeA2 || splitA.b;
  const partnerB = nomeB2 || splitB.b;
  const labelA = labelDupla(splitA.a, partnerA);
  const labelB = labelDupla(splitB.a, partnerB);

  return (
    <Card variant="green">
      <View style={styles.row}>
        <View style={styles.side}>
          <DualAvatar
            nomeA={splitA.a}
            fotoA={fotoA}
            nomeB={partnerA}
            fotoB={fotoA2}
            size="lg"
          />
          <Text style={styles.nome} numberOfLines={2}>
            {labelA}
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
          <DualAvatar
            nomeA={splitB.a}
            fotoA={fotoB}
            nomeB={partnerB}
            fotoB={fotoB2}
            size="lg"
          />
          <Text style={styles.nome} numberOfLines={2}>
            {labelB}
          </Text>
        </View>
      </View>

      <View style={styles.barRow}>
        <View style={[styles.barA, { flex: probabilidadeA }]} />
        <View style={[styles.barB, { flex: probB }]} />
      </View>
      <Text style={styles.barLegend}>
        {splitA.a.split(' ')[0]}
        {partnerA ? `+${partnerA.split(' ')[0]}` : ''} {probabilidadeA}% ·{' '}
        {splitB.a.split(' ')[0]}
        {partnerB ? `+${partnerB.split(' ')[0]}` : ''} {probB}%
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
    fontSize: 12,
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
