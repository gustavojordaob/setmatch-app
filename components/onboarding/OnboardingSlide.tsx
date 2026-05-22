import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Typography } from '../../constants/typography';
import { Button } from '../ui/Button';
import type { OnboardingSlideData } from '../../constants/onboardingSlides';

export interface OnboardingSlideProps extends OnboardingSlideData {
  step: number;
  total: number;
  onNext: () => void;
  isLast: boolean;
}

export function OnboardingSlide({
  emoji,
  title,
  subtitle,
  step,
  total,
  onNext,
  isLast,
}: OnboardingSlideProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i === step - 1 && styles.dotActive]} />
          ))}
        </View>
      </View>
      <Button
        title={isLast ? 'VAMOS COMEÇAR' : 'Próximo'}
        variant="primary"
        onPress={onNext}
        style={styles.cta}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  emoji: { fontSize: 72, marginBottom: 24 },
  title: { ...Typography.sectionTitle, color: Colors.textPrimary, textAlign: 'center', fontSize: 26 },
  subtitle: {
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 14,
    fontSize: 16,
  },
  dots: { flexDirection: 'row', gap: 8, marginTop: 36 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.badge,
    backgroundColor: Colors.border,
  },
  dotActive: { backgroundColor: Colors.accent, width: 24 },
  cta: { marginHorizontal: 24, marginBottom: 24 },
});
