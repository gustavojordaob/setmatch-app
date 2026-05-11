import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

export type BadgeVariant = 'vitoria' | 'derrota';

export interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

export function Badge({ label, variant }: BadgeProps) {
  const isWin = variant === 'vitoria';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: isWin ? Colors.success + '33' : Colors.danger + '33' },
      ]}
    >
      <Text style={[styles.text, { color: isWin ? Colors.success : Colors.danger }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
