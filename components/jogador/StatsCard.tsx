import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Card } from '../ui/Card';

export interface StatsCardProps {
  vitorias: number;
  derrotas: number;
}

export function StatsCard({ vitorias, derrotas }: StatsCardProps) {
  const total = Math.max(vitorias + derrotas, 1);
  const taxa = Math.round((vitorias / total) * 100);
  return (
    <Card>
      <Text style={styles.title}>Estatísticas</Text>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.value}>{vitorias}</Text>
          <Text style={styles.label}>Vitórias</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>{derrotas}</Text>
          <Text style={styles.label}>Derrotas</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.value}>{taxa}%</Text>
          <Text style={styles.label}>Aproveitamento</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    color: Colors.secondary,
    fontSize: 22,
    fontWeight: '900',
  },
  label: {
    color: Colors.textSecondary,
    marginTop: 4,
    fontSize: 12,
    textAlign: 'center',
  },
});
