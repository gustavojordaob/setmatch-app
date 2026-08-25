export interface Noticia {
  id: string;
  titulo: string;
  fonte: string;
  /** ID do esporte — filtro estrito na Home */
  esporte: 'tenis' | 'padel' | 'raquetinha' | 'beachtennis';
  categoria: string;
}

/** Notícias curadas por esporte — cada item só aparece no esporte correspondente. */
export const NOTICIAS: Noticia[] = [
  {
    id: 'n1',
    titulo: 'Alcaraz e Sinner devem se reencontrar em mais uma final de Grand Slam',
    fonte: 'ATP Tour',
    esporte: 'tenis',
    categoria: 'Tênis',
  },
  {
    id: 'n1b',
    titulo: 'Circuito Challenger no Brasil anima a temporada nacional de tênis',
    fonte: 'CBT',
    esporte: 'tenis',
    categoria: 'Tênis',
  },
  {
    id: 'n2',
    titulo: 'Padel cresce no Brasil e já soma mais de 15 mil quadras pelo país',
    fonte: 'CBP',
    esporte: 'padel',
    categoria: 'Padel',
  },
  {
    id: 'n2b',
    titulo: 'World Padel Tour: brasileiros avançam em stages na Europa',
    fonte: 'WPT',
    esporte: 'padel',
    categoria: 'Padel',
  },
  {
    id: 'n3',
    titulo: 'Beach tennis: brasileiros lideram ranking mundial da modalidade',
    fonte: 'ITF',
    esporte: 'beachtennis',
    categoria: 'Beach Tennis',
  },
  {
    id: 'n4',
    titulo: 'Raquetinha ganha força em academias e clubes do interior',
    fonte: 'Rally Up',
    esporte: 'raquetinha',
    categoria: 'Raquetinha',
  },
];
