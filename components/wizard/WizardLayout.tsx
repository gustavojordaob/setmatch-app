import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

export interface WizardLayoutProps {
  step: number;
  total?: number;
  title: string;
  children: React.ReactNode;
  onContinue: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  loading?: boolean;
  contentStyle?: ViewStyle;
}

export function WizardLayout({
  step,
  total = 7,
  title,
  children,
  onContinue,
  continueLabel = 'Continuar',
  continueDisabled,
  loading,
  contentStyle,
}: WizardLayoutProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <ProgressBar current={step} total={total} style={styles.progress} />
      <Text style={styles.stepLabel}>
        {step}/{total}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.body, contentStyle]}>{children}</View>
      <Button
        title={continueLabel}
        variant="primary"
        onPress={onContinue}
        disabled={continueDisabled}
        loading={loading}
        style={styles.cta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  progress: { marginHorizontal: 20, marginTop: 8 },
  stepLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
    marginHorizontal: 20,
  },
  title: {
    ...Typography.sectionTitle,
    color: Colors.textPrimary,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  body: { flex: 1, paddingHorizontal: 20 },
  cta: { marginHorizontal: 20, marginBottom: 20 },
});
