import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';

export interface AvatarProps {
  uri?: string | null;
  nome?: string;
  size?: number;
}

export function Avatar({ uri, nome, size = 44 }: AvatarProps) {
  const initial = (nome?.trim()?.charAt(0) ?? '?').toUpperCase();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text style={[styles.initial, { fontSize: size * 0.38 }]}>{initial}</Text>
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
    borderWidth: 1,
    borderColor: Colors.border,
  },
  initial: {
    color: Colors.secondary,
    fontWeight: '800',
  },
});
