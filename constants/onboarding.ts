import type { ImageSourcePropType } from 'react-native';

export interface OnboardingSlideConfig {
  image: ImageSourcePropType;
  line1Key?: string;
  highlightKey?: string;
  line2Key?: string;
  overlay?: boolean;
  centerKey?: string;
  showLogo?: boolean;
  showButton?: boolean;
}

export const ONBOARDING_SLIDES: OnboardingSlideConfig[] = [
  {
    image: require('../assets/onboarding/Onboarding_1.png'),
    line1Key: 'onboarding.slide1.line1',
    highlightKey: 'onboarding.slide1.highlight',
    line2Key: 'onboarding.slide1.line2',
    showLogo: true,
    showButton: false,
  },
  {
    image: require('../assets/onboarding/Onboarding_2.png'),
    line1Key: 'onboarding.slide2.line1',
    highlightKey: 'onboarding.slide2.highlight',
    line2Key: 'onboarding.slide2.line2',
    showLogo: true,
    showButton: false,
  },
  {
    image: require('../assets/onboarding/Onboarding_3.png'),
    line1Key: 'onboarding.slide3.line1',
    highlightKey: 'onboarding.slide3.highlight',
    line2Key: 'onboarding.slide3.line2',
    showLogo: true,
    showButton: false,
  },
  {
    image: require('../assets/onboarding/onborading_4.png'),
    overlay: true,
    centerKey: 'onboarding.slide4.center',
    showButton: true,
    showLogo: false,
  },
];

export const LOGO_ICON = require('../assets/Vector.png');
