export interface OnboardingSlideData {
  emoji: string;
  title: string;
  subtitle: string;
}

export const ONBOARDING_SLIDES: OnboardingSlideData[] = [
  {
    emoji: '🎾',
    title: 'Desafie quem joga no seu nível',
    subtitle: 'Encontre adversários de tênis, padel, pickleball, raquetinha e beach perto de você.',
  },
  {
    emoji: '📊',
    title: 'Registre cada set',
    subtitle: 'Placar por sets, histórico completo e estatísticas de vitórias e derrotas.',
  },
  {
    emoji: '⚡',
    title: 'Aceite desafios na hora',
    subtitle: 'Notificações de partidas, confirme ou recuse com um toque.',
  },
  {
    emoji: '🏆',
    title: 'Suba no ranking local',
    subtitle: 'Mostre seu record e conquiste a quadra.',
  },
];
