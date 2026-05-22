import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';

/** @deprecated use `primary` */
export type LegacyButtonVariant = ButtonVariant | 'accent' | 'ghost';

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: LegacyButtonVariant;
}

function normalizeVariant(variant: LegacyButtonVariant): ButtonVariant {
  if (variant === 'accent') return 'primary';
  if (variant === 'ghost') return 'outline';
  return variant;
}

export function Button({
  title,
  loading,
  variant = 'primary',
  disabled,
  style,
  ...rest
}: ButtonProps) {
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
        <Text style={[styles.label, v.label]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function stylesForVariant(variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: Colors.primary },
        label: { color: Colors.textPrimary },
        spinnerColor: Colors.textPrimary,
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: Colors.border,
        },
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
    minHeight: 52,
    borderRadius: Radius.pill,
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
