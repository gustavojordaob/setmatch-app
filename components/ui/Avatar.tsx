import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

export type AvatarSize = 'sm' | 'md' | 'lg';

const SIZES: Record<AvatarSize, number> = {
  sm: 32,
  md: 48,
  lg: 80,
};

export interface AvatarProps {
  uri?: string | null;
  nome?: string;
  size?: AvatarSize;
}

function iniciais(nome?: string): string {
  const partes = nome?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

export function Avatar({ uri, nome, size = 'md' }: AvatarProps) {
  const px = SIZES[size];
  const label = iniciais(nome);

  return (
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
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.primary,
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
});
