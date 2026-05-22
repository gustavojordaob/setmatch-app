import type { ImageSourcePropType } from 'react-native';

export interface OnboardingSlideConfig {
  image: ImageSourcePropType;
  linha1?: string;
  destaque?: string;
  linha2?: string;
  overlay?: boolean;
  textoCenter?: string;
  showLogo?: boolean;
  showButton?: boolean;
  buttonLabel?: string;
}

export const ONBOARDING_SLIDES: OnboardingSlideConfig[] = [
  {
    image: require('../assets/onboarding/Onboarding_1.png'),
    linha1: 'Comece',
    destaque: 'a sua jornada',
    linha2: 'para subir\nde nível',
    showLogo: true,
    showButton: false,
  },
  {
    image: require('../assets/onboarding/Onboarding_2.png'),
    linha1: 'Encontre',
    destaque: 'oponentes',
    linha2: 'na sua região',
    showLogo: true,
    showButton: false,
  },
  {
    image: require('../assets/onboarding/Onboarding_3.png'),
    linha1: 'Crie rankings',
    destaque: 'personalizados',
    linha2: 'e participe de\ntorneios!',
    showLogo: true,
    showButton: false,
  },
  {
    image: require('../assets/onboarding/onborading_4.png'),
    overlay: true,
    textoCenter: 'Game, Set, Match.',
    showButton: true,
    buttonLabel: 'VAMOS COMEÇAR',
    showLogo: false,
  },
];

export const LOGO_ICON = require('../assets/Vector.png');
