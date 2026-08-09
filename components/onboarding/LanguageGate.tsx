import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { LOGO_ICON } from '../../constants/onboarding';
import { useLocale } from '../../contexts/LocaleContext';
import { LOCALE_LABEL_KEYS, type AppLocale } from '../../i18n';

const FLAGS: Record<AppLocale, string> = {
  'pt-BR': '🇧🇷',
  'en-US': '🇺🇸',
  es: '🇪🇸',
};

type Props = {
  onContinue: () => void;
};

/** Primeira tela do onboarding — idioma antes dos slides. */
export function LanguageGate({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const { locale, setLocale, t, locales } = useLocale();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.glow} />

      <View style={styles.brand}>
        <Image source={LOGO_ICON} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brandName}>SETMATCH</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>{t('language.gateTitle')}</Text>
        <Text style={styles.subtitle}>{t('language.gateSubtitle')}</Text>
      </View>

      <View style={styles.options}>
        {locales.map((code) => {
          const active = locale === code;
          return (
            <TouchableOpacity
              key={code}
              style={[styles.option, active && styles.optionOn]}
              onPress={() => setLocale(code)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.flag}>{FLAGS[code]}</Text>
              <Text style={[styles.optionLabel, active && styles.optionLabelOn]}>
                {t(LOCALE_LABEL_KEYS[code])}
              </Text>
              <View style={[styles.check, active && styles.checkOn]}>
                {active ? (
                  <Ionicons name="checkmark" size={16} color={Colors.textOnAccent} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.cta} onPress={onContinue} activeOpacity={0.9}>
        <Text style={styles.ctaLabel}>{t('language.continue')}</Text>
        <Ionicons name="arrow-forward" size={20} color={Colors.textOnAccent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  glow: {
    position: 'absolute',
    top: -80,
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.accent,
    opacity: 0.12,
  },
  brand: {
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
  },
  logo: { width: 72, height: 72 },
  brandName: {
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 3,
  },
  copy: { gap: 10, marginTop: 8 },
  title: {
    color: Colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    color: Colors.textPrimary,
    opacity: 0.8,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  options: { gap: 12, marginVertical: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: Colors.surface,
  },
  optionOn: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(199,217,65,0.14)',
  },
  flag: { fontSize: 28 },
  optionLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  optionLabelOn: { color: Colors.accent },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  cta: {
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  ctaLabel: {
    color: Colors.textOnAccent,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
