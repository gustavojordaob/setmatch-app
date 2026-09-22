import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALE_LABEL_KEYS, type AppLocale } from '../../i18n';

export function LanguagePicker() {
  const { locale, setLocale, t, locales } = useLocale();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('language.title')}</Text>
      <Text style={styles.sub}>{t('language.subtitle')}</Text>
      <View style={styles.row}>
        {locales.map((code) => {
          const active = locale === code;
          return (
            <TouchableOpacity
              key={code}
              style={[styles.chip, active && styles.chipOn]}
              onPress={() => setLocale(code as AppLocale)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextOn]}>
                {t(LOCALE_LABEL_KEYS[code])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8, marginTop: 4 },
  title: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  sub: { color: Colors.textPrimary, opacity: 0.75, fontSize: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: Colors.white,
    backgroundColor: 'transparent',
  },
  chipOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: { color: Colors.textPrimary, fontWeight: '700', fontSize: 13 },
  chipTextOn: { color: Colors.textOnAccent },
});
