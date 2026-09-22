/** Rótulo legível do sport_type / type do Strava. */
export function rotuloEsporteStrava(tipo: string): string {
  const key = tipo.trim();
  const map: Record<string, string> = {
    Run: 'Corrida',
    Ride: 'Ciclismo',
    VirtualRide: 'Bike indoor',
    Walk: 'Caminhada',
    Hike: 'Trilha',
    Swim: 'Natação',
    Workout: 'Treino',
    WeightTraining: 'Musculação',
    Tennis: 'Tênis',
    Padel: 'Padel',
    Soccer: 'Futebol',
    Basketball: 'Basquete',
    Yoga: 'Yoga',
    Crossfit: 'Crossfit',
    Elliptical: 'Elíptico',
    Rowing: 'Remo',
    Golf: 'Golfe',
    AlpineSki: 'Esqui',
    BackcountrySki: 'Esqui',
    Canoeing: 'Canoa',
    HighIntensityIntervalTraining: 'HIIT',
  };
  return map[key] || key.replace(/([A-Z])/g, ' $1').trim() || 'Treino';
}

export function iconeEsporteStrava(
  tipo: string
): 'bicycle' | 'walk' | 'water' | 'barbell' | 'tennisball' | 'footsteps' | 'fitness' {
  const t = tipo.toLowerCase();
  if (t.includes('ride') || t.includes('bike')) return 'bicycle';
  if (t.includes('run') || t.includes('walk') || t.includes('hike')) return 'footsteps';
  if (t.includes('swim')) return 'water';
  if (t.includes('weight') || t.includes('workout') || t.includes('crossfit')) return 'barbell';
  if (t.includes('tennis') || t.includes('padel') || t.includes('soccer')) return 'tennisball';
  return 'fitness';
}

export function formatHorarioStrava(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
