import { Image, type ImageSourcePropType, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import type { EsporteId } from '../constants/esportes';

const ICONS: Record<EsporteId, ImageSourcePropType> = {
  tenis: require('../assets/esportes/tenis.png'),
  raquetinha: require('../assets/esportes/raquetinha.png'),
  padel: require('../assets/esportes/padel.png'),
  pickleball: require('../assets/esportes/pickleball.png'),
  beachtennis: require('../assets/esportes/beachtennis.png'),
};

type Props = {
  id: EsporteId;
  size?: number;
  /** Cor do ícone (tint). Default: branco. */
  color?: string;
  /**
   * Mantido por compatibilidade com callers antigos (silhuetas View).
   * Ignorado nos PNGs oficiais.
   */
  cutoutColor?: string;
};

/**
 * Ícones oficiais das modalidades (outline branco + tintColor).
 * Usado na Home, wizard de cadastro e criação de clube.
 */
export function EsporteIcon({
  id,
  size = 28,
  color = Colors.white,
}: Props) {
  const source = ICONS[id] ?? ICONS.tenis;
  return (
    <Image
      source={source}
      style={[styles.icon, { width: size, height: size, tintColor: color }]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  icon: {},
});
