import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import type { AppLocale } from '../../i18n/types';
import {
  addDiasISO,
  formatDiaCurto,
  formatDiaLongo,
  parseDataDigitada,
  placeholderData,
  todayISO,
} from '../../utils/agendaDatas';

type Props = {
  locale: AppLocale;
  diaISO: string;
  onChange: (diaISO: string) => void;
  /** ISO máximo permitido (inclusive) */
  maxISO?: string;
  minISO?: string;
};

export function DiaAgendaPicker({
  locale,
  diaISO,
  onChange,
  maxISO,
  minISO = todayISO(),
}: Props) {
  const [draft, setDraft] = useState(formatDiaCurto(diaISO, locale));

  useEffect(() => {
    setDraft(formatDiaCurto(diaISO, locale));
  }, [diaISO, locale]);

  function clamp(next: string): string {
    if (minISO && next < minISO) return minISO;
    if (maxISO && next > maxISO) return maxISO;
    return next;
  }

  function aplicarDraft() {
    const parsed = parseDataDigitada(draft, locale);
    if (!parsed) {
      setDraft(formatDiaCurto(diaISO, locale));
      return;
    }
    onChange(clamp(parsed));
  }

  function step(delta: number) {
    onChange(clamp(addDiasISO(diaISO, delta)));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.longo}>{formatDiaLongo(diaISO, locale)}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.nav} onPress={() => step(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.accent} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          onBlur={aplicarDraft}
          onSubmitEditing={aplicarDraft}
          placeholder={placeholderData(locale)}
          placeholderTextColor={Colors.textSecondary}
          keyboardType="numbers-and-punctuation"
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.nav} onPress={() => step(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>Formato: {placeholderData(locale)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  longo: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nav: {
    width: 40,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hint: { color: Colors.textSecondary, fontSize: 11 },
});
