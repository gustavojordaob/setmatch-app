import { StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Avatar, type AvatarSize } from './Avatar';

type Props = {
  nomeA: string;
  fotoA?: string | null;
  nomeB?: string | null;
  fotoB?: string | null;
  size?: AvatarSize;
};

/** Dois avatares sobrepostos quando há parceiro de dupla. */
export function DualAvatar({
  nomeA,
  fotoA,
  nomeB,
  fotoB,
  size = 'sm',
}: Props) {
  if (!nomeB) {
    return <Avatar uri={fotoA} nome={nomeA} size={size} />;
  }

  const overlap = size === 'lg' ? 28 : size === 'md' ? 18 : 12;

  return (
    <View style={styles.row}>
      <View style={styles.front}>
        <Avatar uri={fotoA} nome={nomeA} size={size} />
      </View>
      <View style={[styles.back, { marginLeft: -overlap }]}>
        <Avatar uri={fotoB} nome={nomeB} size={size} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  front: { zIndex: 2 },
  back: {
    zIndex: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
});
