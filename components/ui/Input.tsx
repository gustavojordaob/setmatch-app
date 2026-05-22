import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, InputColors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export interface InputProps extends TextInputProps {
  label?: string;
  showPasswordToggle?: boolean;
}

export function Input({
  label,
  showPasswordToggle,
  secureTextEntry,
  style,
  placeholderTextColor = InputColors.placeholder,
  ...rest
}: InputProps) {
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={placeholderTextColor}
          secureTextEntry={showPasswordToggle ? hidden : secureTextEntry}
          {...rest}
        />
        {showPasswordToggle ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  row: { position: 'relative' },
  input: {
    backgroundColor: InputColors.background,
    borderRadius: 30,
    height: 56,
    paddingHorizontal: 18,
    paddingRight: 48,
    color: Colors.textPrimary,
    fontSize: 16,
  },
  eye: {
    position: 'absolute',
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
