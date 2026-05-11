import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { SetPlacar as SetPlacarType } from '../../hooks/usePartidas';

export interface SetPlacarProps {
  index: number;
  placar: SetPlacarType;
}

export function SetPlacar({ index, placar }: SetPlacarProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.setLabel}>Set {index + 1}</Text>
      <Text style={styles.score}>
        {placar.j1} × {placar.j2}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  setLabel: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  score: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
});
