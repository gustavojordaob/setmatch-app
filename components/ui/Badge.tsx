import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export type BadgeVariant = 'vitoria' | 'derrota';

export interface BadgeProps {
  label: string;
  variant: BadgeVariant;
}

export function Badge({ label, variant }: BadgeProps) {
  const isWin = variant === 'vitoria';
  return (
    <View style={[styles.badge, isWin ? styles.vitoria : styles.derrota]}>
      <Text style={[styles.text, isWin ? styles.textVitoria : styles.textDerrota]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  vitoria: {
    backgroundColor: Colors.accent,
  },
  derrota: {
    backgroundColor: Colors.surface,
  },
  text: {
    fontSize: 12,
    fontWeight: '800',
  },
  textVitoria: {
    color: Colors.textOnAccent,
  },
  textDerrota: {
    color: Colors.textPrimary,
  },
});
