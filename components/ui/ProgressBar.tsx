import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export interface ProgressBarProps {
  /** Passo atual (1-based) */
  current: number;
  /** Total de passos */
  total: number;
  style?: ViewStyle;
}

export function ProgressBar({ current, total, style }: ProgressBarProps) {
  const progress = Math.min(Math.max(current / total, 0), 1);

  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${progress * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    backgroundColor: Colors.surface,
    borderRadius: Radius.badge,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: Radius.badge,
  },
});
