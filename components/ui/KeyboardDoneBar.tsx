import {
  InputAccessoryView,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useT } from '../../hooks/useI18n';

export const KEYBOARD_DONE_NATIVE_ID = 'setmatch-keyboard-done';

/** Barra "Pronto" no teclado numérico do iOS (number-pad / phone-pad não têm tecla Enter). */
export function KeyboardDoneBar() {
  const t = useT();
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_NATIVE_ID}>
      <View style={styles.bar}>
        <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={12}>
          <Text style={styles.done}>{t('wizard.keyboardDone')}</Text>
        </TouchableOpacity>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.surfaceDark,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  done: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
