import type { PagamentoDoc, TipoPagamento } from '../types/pagamento';
import { ESPORTES } from '../constants/esportes';

export type RelatorioEscopo = 'total' | 'aula' | 'torneio' | 'ranking';
export type RelatorioPeriodo = 'tudo' | '1m' | '2m' | 'custom';

export type LinhaRelatorio = {
  key: string;
  label: string;
  recebido: number;
  qtd: number;
  filhos?: LinhaRelatorio[];
};

function labelEsporte(id?: string): string {
  if (!id) return 'Outros';
  const hit = ESPORTES.find((e) => e.id === id);
  return hit?.nome || id;
}

export function valorGanho(p: PagamentoDoc): number {
  if (p.valorLiquidoDono != null && Number.isFinite(p.valorLiquidoDono)) {
    return Number(p.valorLiquidoDono);
  }
  return Number(p.valor || 0);
}

export function isPagamentoRecebido(p: PagamentoDoc): boolean {
  return p.status === 'aprovado' || p.status === 'liberado_admin';
}

export function dataPagamento(p: PagamentoDoc): Date | null {
  if (!p.criadoEm?.seconds) return null;
  return new Date(p.criadoEm.seconds * 1000);
}

export function inicioPeriodo(periodo: RelatorioPeriodo): Date | null {
  if (periodo === 'tudo') return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periodo === '1m') d.setMonth(d.getMonth() - 1);
  else if (periodo === '2m') d.setMonth(d.getMonth() - 2);
  return d;
}

export function filtrarPagamentosRelatorio(
  pagamentos: PagamentoDoc[],
  opts: {
    escopo: RelatorioEscopo;
    periodo: RelatorioPeriodo;
    customInicio?: Date | null;
    customFim?: Date | null;
    torneioId?: string | null;
    rankingId?: string | null;
    modalidade?: string | null;
    soRecebidos?: boolean;
  }
): PagamentoDoc[] {
  const soRecebidos = opts.soRecebidos !== false;
  let inicio: Date | null = null;
  let fim: Date | null = null;
  if (opts.periodo === 'custom') {
    inicio = opts.customInicio ?? null;
    fim = opts.customFim ?? null;
  } else {
    inicio = inicioPeriodo(opts.periodo);
  }

  return pagamentos.filter((p) => {
    if (soRecebidos && !isPagamentoRecebido(p)) return false;

    if (opts.escopo === 'aula') {
      if (p.tipo !== 'aula' && p.tipo !== 'aula_online') return false;
    } else if (opts.escopo === 'torneio') {
      if (p.tipo !== 'torneio') return false;
    } else if (opts.escopo === 'ranking') {
      if (p.tipo !== 'ranking') return false;
    }

    if (opts.torneioId) {
      const tid = p.torneioId || p.torneioNome || '';
      if (tid !== opts.torneioId) return false;
    }
    if (opts.rankingId) {
      const rid = p.rankingId || p.rankingNome || '';
      if (rid !== opts.rankingId) return false;
    }

    if (opts.modalidade) {
      const mod =
        p.modalidadeNome ||
        p.aulaTitulo ||
        labelEsporte(p.esporte) ||
        '';
      if (mod !== opts.modalidade) return false;
    }

    const dt = dataPagamento(p);
    if (inicio && dt && dt < inicio) return false;
    if (fim && dt) {
      const fimDia = new Date(fim);
      fimDia.setHours(23, 59, 59, 999);
      if (dt > fimDia) return false;
    }
    if ((inicio || fim) && !dt) return false;
    return true;
  });
}

function agrupar(
  items: PagamentoDoc[],
  keyFn: (p: PagamentoDoc) => string,
  labelFn: (p: PagamentoDoc, key: string) => string
): LinhaRelatorio[] {
  const map = new Map<string, { label: string; recebido: number; qtd: number }>();
  for (const p of items) {
    const key = keyFn(p) || '—';
    const prev = map.get(key) || { label: labelFn(p, key), recebido: 0, qtd: 0 };
    map.set(key, {
      label: prev.label,
      recebido: prev.recebido + valorGanho(p),
      qtd: prev.qtd + 1,
    });
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, label: v.label, recebido: v.recebido, qtd: v.qtd }))
    .sort((a, b) => b.recebido - a.recebido);
}

export function totalLinha(items: PagamentoDoc[]): LinhaRelatorio {
  return {
    key: 'total',
    label: 'Total',
    recebido: items.reduce((acc, p) => acc + valorGanho(p), 0),
    qtd: items.length,
  };
}

export function breakdownPorTipo(items: PagamentoDoc[]): LinhaRelatorio[] {
  return agrupar(
    items,
    (p) => {
      if (p.tipo === 'aula' || p.tipo === 'aula_online') return 'aula';
      if (p.tipo === 'torneio') return 'torneio';
      if (p.tipo === 'ranking') return 'ranking';
      return 'outros';
    },
    (_p, key) => {
      if (key === 'aula') return 'Aulas';
      if (key === 'torneio') return 'Torneios';
      if (key === 'ranking') return 'Rankings';
      return 'Outros';
    }
  );
}

export function breakdownAulasPorModalidade(items: PagamentoDoc[]): LinhaRelatorio[] {
  const aulas = items.filter((p) => p.tipo === 'aula' || p.tipo === 'aula_online');
  return agrupar(
    aulas,
    (p) => p.modalidadeNome || p.aulaTitulo || 'Aulas',
    (p, key) => p.modalidadeNome || p.aulaTitulo || key
  );
}

export function breakdownTorneios(items: PagamentoDoc[]): LinhaRelatorio[] {
  const torneios = items.filter((p) => p.tipo === 'torneio');
  const porTorneio = agrupar(
    torneios,
    (p) => p.torneioId || p.torneioNome || 'torneio',
    (p, key) => p.torneioNome || key
  );

  return porTorneio.map((t) => {
    const doTorneio = torneios.filter(
      (p) => (p.torneioId || p.torneioNome || 'torneio') === t.key
    );
    const porCategoria = agrupar(
      doTorneio,
      (p) => p.categoriaId || p.categoriaNome || 'geral',
      (p, key) => p.categoriaNome || (key === 'geral' ? 'Geral / sem categoria' : key)
    );
    const porModalidade = agrupar(
      doTorneio,
      (p) => p.esporte || p.modalidadeNome || 'modalidade',
      (p, key) =>
        p.esporte
          ? labelEsporte(p.esporte)
          : p.modalidadeNome || (key === 'modalidade' ? 'Modalidade' : key)
    );
    return {
      ...t,
      filhos: [
        ...porCategoria.map((c) => ({ ...c, label: `Cat. ${c.label}` })),
        ...porModalidade.map((m) => ({ ...m, label: `Mod. ${m.label}` })),
      ],
    };
  });
}

export function breakdownRankings(items: PagamentoDoc[]): LinhaRelatorio[] {
  const rankings = items.filter((p) => p.tipo === 'ranking');
  const porRanking = agrupar(
    rankings,
    (p) => p.rankingId || p.rankingNome || 'ranking',
    (p, key) => p.rankingNome || key
  );
  return porRanking.map((r) => {
    const doRanking = rankings.filter(
      (p) => (p.rankingId || p.rankingNome || 'ranking') === r.key
    );
    const porModalidade = agrupar(
      doRanking,
      (p) => p.esporte || p.modalidadeNome || 'geral',
      (p, key) =>
        p.esporte
          ? labelEsporte(p.esporte)
          : p.modalidadeNome || (key === 'geral' ? 'Geral' : key)
    );
    return {
      ...r,
      filhos: porModalidade.length
        ? porModalidade.map((m) => ({ ...m, label: `Mod. ${m.label}` }))
        : undefined,
    };
  });
}

export function opcoesTorneios(
  pagamentos: PagamentoDoc[]
): { id: string; nome: string }[] {
  const map = new Map<string, string>();
  for (const p of pagamentos) {
    if (p.tipo !== 'torneio') continue;
    const id = p.torneioId || p.torneioNome;
    if (!id) continue;
    map.set(id, p.torneioNome || id);
  }
  return [...map.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function opcoesRankings(
  pagamentos: PagamentoDoc[]
): { id: string; nome: string }[] {
  const map = new Map<string, string>();
  for (const p of pagamentos) {
    if (p.tipo !== 'ranking') continue;
    const id = p.rankingId || p.rankingNome;
    if (!id) continue;
    map.set(id, p.rankingNome || id);
  }
  return [...map.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function opcoesModalidadesAula(pagamentos: PagamentoDoc[]): string[] {
  const set = new Set<string>();
  for (const p of pagamentos) {
    if (p.tipo !== 'aula' && p.tipo !== 'aula_online') continue;
    const n = p.modalidadeNome || p.aulaTitulo;
    if (n) set.add(n);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function parseDataBR(txt: string): Date | null {
  const m = String(txt || '')
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
    return null;
  }
  return d;
}

export function tipoLabel(tipo: TipoPagamento | string): string {
  if (tipo === 'aula' || tipo === 'aula_online') return 'AULA';
  if (tipo === 'torneio') return 'TORNEIO';
  if (tipo === 'ranking') return 'RANKING';
  return String(tipo).toUpperCase();
}
