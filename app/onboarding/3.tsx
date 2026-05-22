import { useRouter } from 'expo-router';
import { OnboardingSlide } from '../../components/onboarding/OnboardingSlide';
import { ONBOARDING_SLIDES } from '../../constants/onboardingSlides';

export default function Onboarding3() {
  const router = useRouter();
  const slide = ONBOARDING_SLIDES[2];
  return (
    <OnboardingSlide
      {...slide}
      step={3}
      total={4}
      isLast={false}
      onNext={() => router.push('/onboarding/4')}
    />
  );
}
