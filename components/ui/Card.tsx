import { StyleSheet, View, type ViewProps } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export type CardVariant = 'default' | 'green';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
}

export function Card({ style, variant = 'default', ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        variant === 'green' ? styles.green : styles.default,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    padding: 16,
  },
  default: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  green: {
    backgroundColor: Colors.surfaceGreen,
    borderWidth: 0,
  },
});
