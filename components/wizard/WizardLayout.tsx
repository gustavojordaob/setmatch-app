import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { useT } from '../../hooks/useI18n';
import { Button } from '../ui/Button';
import { ButtonFooter } from '../ui/ButtonFooter';

export interface WizardLayoutProps {
  title: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  contentStyle?: ViewStyle;
  showBack?: boolean;
}

export function WizardLayout({
  title,
  children,
  onContinue,
  continueLabel,
  continueDisabled,
  loading,
  contentStyle,
  showBack = true,
}: WizardLayoutProps) {
  const router = useRouter();
  const t = useT();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {showBack ? (
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.title}>{title}</Text>
      <View style={[styles.body, contentStyle]}>{children}</View>

      <Text style={styles.infoLink}>{t('wizard.whyInfo')}</Text>

      <ButtonFooter>
        <Button
          label={continueLabel ?? t('wizard.continue')}
          variant="primary"
          onPress={onContinue}
          disabled={continueDisabled}
          loading={loading}
        />
      </ButtonFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, alignItems: 'stretch' },
  back: { paddingHorizontal: 20, paddingTop: 8 },
  backArrow: { color: Colors.accent, fontSize: 28, fontWeight: 'bold' },
  title: {
    ...Typography.sectionTitle,
    color: Colors.textPrimary,
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 20,
    marginTop: 16,
    textAlign: 'center',
  },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  infoLink: {
    color: Colors.textPrimary,
    textAlign: 'center',
    textDecorationLine: 'underline',
    fontSize: 13,
    marginBottom: 12,
    opacity: 0.9,
  },
});
