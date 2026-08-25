export type BadgeDef = {
  id: string;
  nome: string;
  descricao: string;
  icon:
    | 'ribbon'
    | 'fitness'
    | 'medal'
    | 'tennisball'
    | 'flame'
    | 'trophy'
    | 'people'
    | 'flash';
};

export const BADGES: BadgeDef[] = [
  {
    id: 'primeira_vitoria',
    nome: 'Primeira vitória',
    descricao: 'Venceu sua primeira partida',
    icon: 'ribbon',
  },
  {
    id: 'em_forma',
    nome: 'Em forma',
    descricao: '5 vitórias no currículo',
    icon: 'fitness',
  },
  {
    id: 'competidor',
    nome: 'Competidor',
    descricao: '10 vitórias',
    icon: 'medal',
  },
  {
    id: 'veterano',
    nome: 'Veterano',
    descricao: '25 jogos disputados',
    icon: 'tennisball',
  },
  {
    id: 'dominante',
    nome: 'Dominante',
    descricao: 'Aproveitamento ≥ 70% (mín. 5 jogos)',
    icon: 'flame',
  },
  {
    id: 'campeao',
    nome: 'Campeão',
    descricao: 'Venceu um torneio no Rally Up',
    icon: 'trophy',
  },
  {
    id: 'social',
    nome: 'Social',
    descricao: 'Perfil completo com foto e cidade',
    icon: 'people',
  },
  {
    id: 'desafiante',
    nome: 'Desafiante',
    descricao: 'Já finalizou um confronto',
    icon: 'flash',
  },
];

export function badgesConquistados(input: {
  vitorias: number;
  derrotas: number;
  temFoto?: boolean;
  temCidade?: boolean;
  campeaoTorneio?: boolean;
}): BadgeDef[] {
  const jogos = input.vitorias + input.derrotas;
  const taxa = jogos > 0 ? input.vitorias / jogos : 0;
  const ids: string[] = [];

  if (input.vitorias >= 1) ids.push('primeira_vitoria', 'desafiante');
  if (input.vitorias >= 5) ids.push('em_forma');
  if (input.vitorias >= 10) ids.push('competidor');
  if (jogos >= 25) ids.push('veterano');
  if (jogos >= 5 && taxa >= 0.7) ids.push('dominante');
  if (input.campeaoTorneio) ids.push('campeao');
  if (input.temFoto && input.temCidade) ids.push('social');

  return BADGES.filter((b) => ids.includes(b.id));
}
