import { FORMATOS_PARTIDA } from '../constants/formatosPartida';

export type SetPlacar = { j1: number; j2: number };

/** Regras internas normalizadas a partir de qualquer id de formato (torneio/ranking/desafio). */
export type RegrasPlacar = {
  /** Quantos “jogos” (sets/games) precisa vencer para fechar. */
  setsParaVencer: number;
  /** Se true e setsParaVencer===2, o 3º jogo é super TB (não set completo). */
  temSuperTiebreak: boolean;
  tiebreakAte: number;
  /** Partida de um único placar (pro set, TB, game 11/8/15…). */
  unicoPlacar: boolean;
  /** Sempre joga N sets (ex.: dois_sets fixos). */
  setsFixos?: number;
  rotuloUnico?: string;
};

/**
 * Mapeia ids de torneio (tres_sets_de_3, game_8…) e de desafio (melhor_de_3_stb…).
 */
export function regrasPlacarPorFormato(formatoId?: string | null): RegrasPlacar {
  const id = String(formatoId ?? '').trim();

  // IDs canônicos do desafio
  const base = FORMATOS_PARTIDA.find((f) => f.id === id);
  if (base) {
    if (
      base.id === 'so_tiebreak' ||
      base.id === 'pro_set' ||
      base.id === 'game_11'
    ) {
      return {
        setsParaVencer: 1,
        temSuperTiebreak: base.temSuperTiebreak,
        tiebreakAte: base.tiebreakAte,
        unicoPlacar: true,
        rotuloUnico:
          base.id === 'so_tiebreak'
            ? `Tiebreak (até ${base.tiebreakAte})`
            : base.id === 'game_11'
              ? 'Game (até 11)'
              : 'Pro set',
      };
    }
    if (base.id === 'dois_sets') {
      return {
        setsParaVencer: 2,
        temSuperTiebreak: false,
        tiebreakAte: 7,
        unicoPlacar: false,
        setsFixos: 2,
      };
    }
    if (base.id === 'melhor_de_3_games_11') {
      return {
        setsParaVencer: 2,
        temSuperTiebreak: false,
        tiebreakAte: 11,
        unicoPlacar: false,
      };
    }
    return {
      setsParaVencer: base.setsParaVencer,
      temSuperTiebreak: base.temSuperTiebreak,
      tiebreakAte: base.tiebreakAte,
      unicoPlacar: false,
    };
  }

  // IDs extras de torneio/ranking
  switch (id) {
    case 'tres_sets_de_3':
      return { setsParaVencer: 2, temSuperTiebreak: false, tiebreakAte: 7, unicoPlacar: false };
    case 'dois_sets_de_3':
      return {
        setsParaVencer: 2,
        temSuperTiebreak: false,
        tiebreakAte: 7,
        unicoPlacar: false,
        setsFixos: 2,
      };
    case 'um_set_de_6':
      return {
        setsParaVencer: 1,
        temSuperTiebreak: false,
        tiebreakAte: 7,
        unicoPlacar: true,
        rotuloUnico: 'Set (até 6)',
      };
    case 'dois_sets_de_6':
      return {
        setsParaVencer: 2,
        temSuperTiebreak: false,
        tiebreakAte: 7,
        unicoPlacar: false,
        setsFixos: 2,
      };
    case 'game_8':
      return {
        setsParaVencer: 1,
        temSuperTiebreak: false,
        tiebreakAte: 8,
        unicoPlacar: true,
        rotuloUnico: 'Game (até 8)',
      };
    case 'game_15':
      return {
        setsParaVencer: 1,
        temSuperTiebreak: false,
        tiebreakAte: 15,
        unicoPlacar: true,
        rotuloUnico: 'Game (até 15)',
      };
    case 'melhor_de_5_stb':
      return {
        setsParaVencer: 3,
        temSuperTiebreak: true,
        tiebreakAte: 10,
        unicoPlacar: false,
      };
    default:
      // fallback: melhor de 3 + STB (padrão Rally Up)
      return {
        setsParaVencer: 2,
        temSuperTiebreak: true,
        tiebreakAte: 10,
        unicoPlacar: false,
      };
  }
}

export function vencedorDoSet(s: SetPlacar): 'j1' | 'j2' | null {
  if (s.j1 === s.j2) return null;
  return s.j1 > s.j2 ? 'j1' : 'j2';
}

export function setsVencidos(sets: SetPlacar[]): { j1: number; j2: number } {
  let j1 = 0;
  let j2 = 0;
  for (const s of sets) {
    const w = vencedorDoSet(s);
    if (w === 'j1') j1 += 1;
    if (w === 'j2') j2 += 1;
  }
  return { j1, j2 };
}

export function quantosSetsVisiveis(
  formatoId: string | undefined,
  setsParciais: SetPlacar[]
): number {
  const r = regrasPlacarPorFormato(formatoId);
  if (r.unicoPlacar) return 1;
  if (r.setsFixos) return r.setsFixos;

  const need = r.setsParaVencer;
  const won = setsVencidos(setsParciais.slice(0, need === 3 ? 5 : 3));

  // melhor de 5 + STB: se 2–2, abre 5º como STB
  if (r.temSuperTiebreak && need === 3) {
    if (won.j1 >= 3 || won.j2 >= 3) return Math.max(won.j1 + won.j2, 3);
    if (won.j1 === 2 && won.j2 === 2) return 5;
    return Math.min(5, Math.max(3, won.j1 + won.j2 + 1));
  }

  if (r.temSuperTiebreak && need === 2) {
    if (won.j1 >= 1 && won.j2 >= 1) return 3;
    return 2;
  }

  if (need === 3) {
    if (won.j1 >= 3 || won.j2 >= 3) return Math.max(won.j1 + won.j2, 3);
    return Math.min(5, Math.max(3, won.j1 + won.j2 + 1));
  }

  // melhor de 3 clássico
  if (won.j1 >= 2 || won.j2 >= 2) return Math.max(2, won.j1 + won.j2);
  if (won.j1 === 1 && won.j2 === 1) return 3;
  return 2;
}

export function precisaSuperTiebreak(
  formatoId: string | undefined,
  sets: SetPlacar[]
): boolean {
  const r = regrasPlacarPorFormato(formatoId);
  if (!r.temSuperTiebreak) return false;
  if (r.setsParaVencer === 2) {
    const won = setsVencidos(sets.slice(0, 2));
    return won.j1 === 1 && won.j2 === 1;
  }
  if (r.setsParaVencer === 3) {
    const won = setsVencidos(sets.slice(0, 4));
    return won.j1 === 2 && won.j2 === 2;
  }
  return false;
}

export function rotuloSet(
  formatoId: string | undefined,
  index: number,
  sets: SetPlacar[]
): string {
  const r = regrasPlacarPorFormato(formatoId);
  if (r.unicoPlacar) return r.rotuloUnico ?? 'Placar';
  if (precisaSuperTiebreak(formatoId, sets) && index === (r.setsParaVencer === 3 ? 4 : 2)) {
    return `Super tiebreak (até ${r.tiebreakAte})`;
  }
  return `Set ${index + 1}`;
}

/** Valida placar e devolve lado vencedor. */
export function validarPlacarTorneio(input: {
  formatoId?: string;
  sets: SetPlacar[];
}): { ok: true; vencedor: 'j1' | 'j2'; sets: SetPlacar[] } | { ok: false; erro: string } {
  const r = regrasPlacarPorFormato(input.formatoId);
  const n = quantosSetsVisiveis(input.formatoId, input.sets);
  const sets = input.sets.slice(0, n).map((s) => ({
    j1: Math.max(0, Math.floor(Number(s.j1) || 0)),
    j2: Math.max(0, Math.floor(Number(s.j2) || 0)),
  }));

  for (let i = 0; i < sets.length; i++) {
    if (sets[i].j1 === sets[i].j2) {
      return { ok: false, erro: `${rotuloSet(input.formatoId, i, sets)} não pode empatar.` };
    }
  }

  if (r.unicoPlacar) {
    const w = vencedorDoSet(sets[0]);
    if (!w) return { ok: false, erro: 'Informe o placar.' };
    const precisaAlvo =
      !!r.rotuloUnico &&
      (r.rotuloUnico.toLowerCase().includes('tiebreak') ||
        r.rotuloUnico.toLowerCase().includes('game'));
    if (precisaAlvo && Math.max(sets[0].j1, sets[0].j2) < r.tiebreakAte) {
      return {
        ok: false,
        erro: `Alguém precisa chegar a ${r.tiebreakAte} pontos.`,
      };
    }
    return { ok: true, vencedor: w, sets: sets.slice(0, 1) };
  }

  if (r.setsFixos) {
    const won = setsVencidos(sets.slice(0, r.setsFixos));
    if (sets.length < r.setsFixos) {
      return { ok: false, erro: `Informe os ${r.setsFixos} sets.` };
    }
    if (won.j1 === won.j2) {
      return { ok: false, erro: 'Empate em sets — informe placares diferentes.' };
    }
    return {
      ok: true,
      vencedor: won.j1 > won.j2 ? 'j1' : 'j2',
      sets: sets.slice(0, r.setsFixos),
    };
  }

  const won = setsVencidos(sets);
  const need = r.setsParaVencer;

  if (r.temSuperTiebreak && need === 2) {
    const s1 = vencedorDoSet(sets[0]);
    const s2 = vencedorDoSet(sets[1]);
    if (!s1 || !s2) return { ok: false, erro: 'Preencha os 2 primeiros sets.' };
    if (s1 === s2) return { ok: true, vencedor: s1, sets: sets.slice(0, 2) };
    if (sets.length < 3) {
      return {
        ok: false,
        erro: `Empate 1–1: informe o super tiebreak (até ${r.tiebreakAte}).`,
      };
    }
    const stb = sets[2];
    if (Math.max(stb.j1, stb.j2) < r.tiebreakAte) {
      return {
        ok: false,
        erro: `Super tiebreak: alguém precisa chegar a ${r.tiebreakAte} pontos.`,
      };
    }
    const w = vencedorDoSet(stb);
    if (!w) return { ok: false, erro: 'Super tiebreak inválido.' };
    return { ok: true, vencedor: w, sets: sets.slice(0, 3) };
  }

  if (r.temSuperTiebreak && need === 3) {
    if (won.j1 >= 3 || won.j2 >= 3) {
      return {
        ok: true,
        vencedor: won.j1 > won.j2 ? 'j1' : 'j2',
        sets,
      };
    }
    const beforeStb = setsVencidos(sets.slice(0, 4));
    if (beforeStb.j1 === 2 && beforeStb.j2 === 2) {
      if (sets.length < 5) {
        return {
          ok: false,
          erro: `Empate 2–2: informe o super tiebreak (até ${r.tiebreakAte}).`,
        };
      }
      const stb = sets[4];
      if (Math.max(stb.j1, stb.j2) < r.tiebreakAte) {
        return {
          ok: false,
          erro: `Super tiebreak: alguém precisa chegar a ${r.tiebreakAte} pontos.`,
        };
      }
      const w = vencedorDoSet(stb);
      if (!w) return { ok: false, erro: 'Super tiebreak inválido.' };
      return { ok: true, vencedor: w, sets: sets.slice(0, 5) };
    }
    return {
      ok: false,
      erro: `É preciso vencer ${need} sets para fechar o confronto.`,
    };
  }

  if (won.j1 < need && won.j2 < need) {
    return {
      ok: false,
      erro: `É preciso vencer ${need} sets para fechar o confronto.`,
    };
  }
  if (won.j1 === won.j2) {
    return { ok: false, erro: 'Placar inválido — sem vencedor.' };
  }
  return {
    ok: true,
    vencedor: won.j1 > won.j2 ? 'j1' : 'j2',
    sets,
  };
}

/** Alias — ranking/desafio usam a mesma validação. */
export const validarPlacarPartida = validarPlacarTorneio;
