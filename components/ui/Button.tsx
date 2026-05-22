import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';

export interface ButtonProps extends TouchableOpacityProps {
  /** Alias Figma: `label` */
  title?: string;
  label?: string;
  loading?: boolean;
  variant?: ButtonVariant | 'secondary' | 'accent';
}

function normalizeVariant(v: ButtonProps['variant']): ButtonVariant {
  if (v === 'secondary' || v === 'accent') return 'primary';
  return v ?? 'primary';
}

export function Button({
  title,
  label,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const text = label ?? title ?? '';
  const v = stylesForVariant(normalizeVariant(variant));
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
        <Text style={[styles.label, v.label]}>{text}</Text>
      )}
    </TouchableOpacity>
  );
}

function stylesForVariant(variant: ButtonVariant) {
  switch (variant) {
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: Colors.white,
        },
        label: { color: Colors.textPrimary },
        spinnerColor: Colors.textPrimary,
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        label: { color: Colors.textPrimary },
        spinnerColor: Colors.textPrimary,
      };
    default:
      return {
        container: { backgroundColor: Colors.accent },
        label: { color: Colors.textOnAccent },
        spinnerColor: Colors.textOnAccent,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    borderRadius: Radius.pill,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabled: { opacity: 0.45 },
});
