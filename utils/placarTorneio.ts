import { FORMATOS_PARTIDA } from '../constants/formatosPartida';

export type SetPlacar = { j1: number; j2: number };
export type SetDraft = { j1: string; j2: string };

/** Regras internas normalizadas a partir de qualquer id de formato (torneio/ranking/desafio). */
export type RegrasPlacar = {
  /** Quantos sets/game precisa vencer para fechar (melhor de N → ceil(N/2)). */
  setsParaVencer: number;
  /** Se true, o jogo decisivo empatado vira super TB (não set completo). */
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

  switch (id) {
    case 'tres_sets_de_3':
      // Melhor de 3 (quem vencer 2), games curtos até 3
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
      // fallback: 2 sets + STB (padrão Rally Up)
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

/**
 * Só conta sets já decididos (sem empate), do início até o primeiro incompleto.
 * Ignora 0–0 / vazios no fim do draft — evita travar a progressive UI.
 */
export function setsDecididos(sets: SetPlacar[]): SetPlacar[] {
  const out: SetPlacar[] = [];
  for (const s of sets) {
    if (vencedorDoSet(s) == null) break;
    out.push(s);
  }
  return out;
}

/** Converte draft de inputs (string) → placares numéricos (vazio = 0). */
export function draftParaSets(draft: SetDraft[]): SetPlacar[] {
  return draft.map((s) => ({
    j1: Math.max(0, Math.floor(Number(s.j1) || 0)),
    j2: Math.max(0, Math.floor(Number(s.j2) || 0)),
  }));
}

/**
 * Quantos campos de set mostrar no formulário.
 * Progressive: abre o próximo set até alguém atingir `setsParaVencer`.
 */
export function quantosSetsVisiveis(
  formatoId: string | undefined,
  setsParciais: SetPlacar[]
): number {
  const r = regrasPlacarPorFormato(formatoId);
  if (r.unicoPlacar) return 1;
  if (r.setsFixos) return r.setsFixos;

  const need = r.setsParaVencer;
  const maxSets = need * 2 - 1; // melhor de 3 → 3; melhor de 5 → 5
  const decided = setsDecididos(setsParciais);
  const won = setsVencidos(decided);

  // Partida já fechada
  if (won.j1 >= need || won.j2 >= need) {
    return Math.max(need, decided.length);
  }

  // Super TB no lugar do set decisivo
  if (r.temSuperTiebreak) {
    const empatados = need - 1; // 1–1 (md3) ou 2–2 (md5)
    if (won.j1 === empatados && won.j2 === empatados) {
      return decided.length + 1; // abre o STB
    }
  }

  // Ainda em andamento: mostra decididos + 1 slot vazio (mínimo = need na abertura)
  const proximo = decided.length + 1;
  return Math.min(maxSets, Math.max(need, proximo));
}

export function precisaSuperTiebreak(
  formatoId: string | undefined,
  sets: SetPlacar[]
): boolean {
  const r = regrasPlacarPorFormato(formatoId);
  if (!r.temSuperTiebreak) return false;
  const need = r.setsParaVencer;
  const won = setsVencidos(setsDecididos(sets).slice(0, need * 2 - 2));
  return won.j1 === need - 1 && won.j2 === need - 1;
}

export function rotuloSet(
  formatoId: string | undefined,
  index: number,
  sets: SetPlacar[]
): string {
  const r = regrasPlacarPorFormato(formatoId);
  if (r.unicoPlacar) return r.rotuloUnico ?? 'Placar';
  const stbIndex = r.setsParaVencer * 2 - 2; // 2 (md3) ou 4 (md5)
  if (precisaSuperTiebreak(formatoId, sets) && index === stbIndex) {
    return `Super tiebreak (até ${r.tiebreakAte})`;
  }
  return `Set ${index + 1}`;
}

/** Texto de status no modal (ex.: "Sets 2–1 · informe o 4º set"). */
export function statusPlacarProgressivo(
  formatoId: string | undefined,
  sets: SetPlacar[]
): string {
  const r = regrasPlacarPorFormato(formatoId);
  if (r.unicoPlacar) return r.rotuloUnico ?? 'Informe o placar';
  if (r.setsFixos) return `Informe os ${r.setsFixos} sets`;

  const decided = setsDecididos(sets);
  const won = setsVencidos(decided);
  const need = r.setsParaVencer;

  if (won.j1 >= need || won.j2 >= need) {
    return `Sets ${won.j1}–${won.j2} · partida definida`;
  }
  if (r.temSuperTiebreak && won.j1 === need - 1 && won.j2 === need - 1) {
    return `Sets ${won.j1}–${won.j2} · super tiebreak até ${r.tiebreakAte}`;
  }
  if (decided.length === 0) {
    return `Melhor de ${need * 2 - 1} · quem vencer ${need} sets`;
  }
  const nVis = quantosSetsVisiveis(formatoId, sets);
  return `Sets ${won.j1}–${won.j2} · informe o ${nVis}º set`;
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
      return {
        ok: false,
        erro: `${rotuloSet(input.formatoId, i, sets)} não pode empatar — preencha o placar.`,
      };
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
    if (sets.length < r.setsFixos) {
      return { ok: false, erro: `Informe os ${r.setsFixos} sets.` };
    }
    const won = setsVencidos(sets.slice(0, r.setsFixos));
    if (won.j1 === won.j2) {
      return { ok: false, erro: 'Empate em sets — informe placares diferentes.' };
    }
    return {
      ok: true,
      vencedor: won.j1 > won.j2 ? 'j1' : 'j2',
      sets: sets.slice(0, r.setsFixos),
    };
  }

  const need = r.setsParaVencer;
  const decided = setsDecididos(sets);
  const won = setsVencidos(decided);

  if (r.temSuperTiebreak) {
    const empatados = need - 1;
    if (won.j1 >= need || won.j2 >= need) {
      return {
        ok: true,
        vencedor: won.j1 > won.j2 ? 'j1' : 'j2',
        sets: decided,
      };
    }
    if (won.j1 === empatados && won.j2 === empatados) {
      const stbIdx = decided.length;
      if (sets.length <= stbIdx) {
        return {
          ok: false,
          erro: `Empate ${empatados}–${empatados}: informe o super tiebreak (até ${r.tiebreakAte}).`,
        };
      }
      const stb = sets[stbIdx];
      if (stb.j1 === stb.j2) {
        return { ok: false, erro: 'Super tiebreak não pode empatar.' };
      }
      if (Math.max(stb.j1, stb.j2) < r.tiebreakAte) {
        return {
          ok: false,
          erro: `Super tiebreak: alguém precisa chegar a ${r.tiebreakAte} pontos.`,
        };
      }
      const w = vencedorDoSet(stb);
      if (!w) return { ok: false, erro: 'Super tiebreak inválido.' };
      return { ok: true, vencedor: w, sets: [...decided, stb] };
    }
    return {
      ok: false,
      erro: statusPlacarProgressivo(input.formatoId, sets),
    };
  }

  if (won.j1 < need && won.j2 < need) {
    return {
      ok: false,
      erro: statusPlacarProgressivo(input.formatoId, sets),
    };
  }
  if (won.j1 === won.j2) {
    return { ok: false, erro: 'Placar inválido — sem vencedor.' };
  }
  return {
    ok: true,
    vencedor: won.j1 > won.j2 ? 'j1' : 'j2',
    sets: decided,
  };
}

/** Alias — ranking/desafio usam a mesma validação. */
export const validarPlacarPartida = validarPlacarTorneio;
