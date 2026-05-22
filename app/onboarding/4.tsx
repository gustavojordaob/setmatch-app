import { useRouter } from 'expo-router';
import { OnboardingSlide } from '../../components/onboarding/OnboardingSlide';
import { ONBOARDING_SLIDES } from '../../constants/onboardingSlides';

export default function Onboarding4() {
  const router = useRouter();
  const slide = ONBOARDING_SLIDES[3];
  return (
    <OnboardingSlide
      {...slide}
      step={4}
      total={4}
      isLast
      onNext={() => router.replace('/(auth)/login')}
    />
  );
}
