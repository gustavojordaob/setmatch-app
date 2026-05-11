import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { Colors } from '../../constants/colors';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: Variant;
}

export function Button({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const v = stylesForVariant(variant);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.base, v.container, disabled && styles.disabled, style]}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={v.spinnerColor} />
      ) : (
        <Text style={[styles.label, v.label]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function stylesForVariant(variant: Variant) {
  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: Colors.secondary },
        label: { color: Colors.primary },
        spinnerColor: Colors.primary,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.border },
        label: { color: Colors.textPrimary },
        spinnerColor: Colors.textPrimary,
      };
    default:
      return {
        container: { backgroundColor: Colors.primary },
        label: { color: Colors.textPrimary },
        spinnerColor: Colors.secondary,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});
