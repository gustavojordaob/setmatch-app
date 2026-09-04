import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
  xl: 120,
};

export interface AvatarProps {
  uri?: string | null;
  nome?: string;
  size?: AvatarSize;
  verified?: boolean;
}

function iniciais(nome?: string): string {
  const partes = nome?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ uri, nome, size = 'md', verified }: AvatarProps) {
  const px = SIZES[size];
  const label = iniciais(nome);

  return (
    <View style={styles.outer}>
      <View style={[styles.wrap, { width: px, height: px, borderRadius: px / 2 }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width: px, height: px, borderRadius: px / 2 }}
          />
        ) : (
          <Text style={[styles.initial, { fontSize: px * 0.36 }]}>{label}</Text>
        )}
      </View>
      {verified ? (
        <View style={styles.badge}>
          <Ionicons name="checkmark" size={12} color={Colors.textOnAccent} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'relative' },
  wrap: {
    backgroundColor: Colors.avatarPlaceholder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  initial: {
    color: Colors.accent,
    fontWeight: '800',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
});
