import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

type Nivel = {
  id: string;
  nome: string;
  ordem: number;
  sobeQuantos: number;
  caiQuantos: number;
};

type ClassRow = {
  uid: string;
  nome: string;
  pts: number;
  nivelId?: string;
};

function mesCivilSP(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  });
  // en-CA → YYYY-MM-DD
  return fmt.format(d).slice(0, 7);
}

function diaMesSP(d = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
  });
  return Number(fmt.format(d));
}

function calcularMovimentacao(niveis: Nivel[], rows: ClassRow[]) {
  const ordenados = [...niveis].sort((a, b) => a.ordem - b.ordem);
  if (ordenados.length < 2) return [] as { uid: string; paraNivelId: string }[];

  const porNivel = new Map<string, ClassRow[]>();
  for (const n of ordenados) porNivel.set(n.id, []);
  const fallback = ordenados[ordenados.length - 1].id;
  for (const r of rows) {
    const nid = r.nivelId && porNivel.has(r.nivelId) ? r.nivelId : fallback;
    porNivel.get(nid)!.push(r);
  }
  for (const [, list] of porNivel) {
    list.sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0));
  }

  const moves = new Map<string, string>();
  for (let i = 0; i < ordenados.length - 1; i++) {
    const upper = ordenados[i];
    const lower = ordenados[i + 1];
    const upperRows = porNivel.get(upper.id) ?? [];
    const lowerRows = porNivel.get(lower.id) ?? [];
    const qCai = Math.min(upper.caiQuantos, upperRows.length);
    const qSobe = Math.min(lower.sobeQuantos, lowerRows.length);
    for (const p of upperRows.slice(Math.max(0, upperRows.length - qCai))) {
      moves.set(p.uid, lower.id);
    }
    for (const p of lowerRows.slice(0, qSobe)) {
      moves.set(p.uid, upper.id);
    }
  }
  return [...moves.entries()].map(([uid, paraNivelId]) => ({ uid, paraNivelId }));
}

/**
 * Todo dia 06:00 (SP): se for o `autoDiaMes` do ranking e níveis ativos + auto,
 * aplica sobe/desce uma vez por mês.
 */
export const aplicarMovimentacaoRankingsMensal = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
  },
  async () => {
    const db = getFirestore();
    const mes = mesCivilSP();
    const dia = diaMesSP();
    const snap = await db.collection('rankings').get();

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const niveisCfg = data.niveis as
        | {
            ativo?: boolean;
            autoAtivo?: boolean;
            autoDiaMes?: number;
            niveis?: Nivel[];
            ultimaMovimentacaoMes?: string;
          }
        | undefined;
      if (!niveisCfg?.ativo || niveisCfg.autoAtivo === false) continue;
      const niveis = Array.isArray(niveisCfg.niveis) ? niveisCfg.niveis : [];
      if (niveis.length < 2) continue;
      const diaCfg = Math.min(28, Math.max(1, Number(niveisCfg.autoDiaMes) || 1));
      if (dia !== diaCfg) continue;
      if (niveisCfg.ultimaMovimentacaoMes === mes) continue;

      const classSnap = await docSnap.ref.collection('classificacao').get();
      const rows: ClassRow[] = classSnap.docs.map((d) => {
        const r = d.data();
        return {
          uid: d.id,
          nome: String(r.nome ?? ''),
          pts: Number(r.pts ?? 0),
          nivelId: r.nivelId ? String(r.nivelId) : undefined,
        };
      });

      const moves = calcularMovimentacao(niveis, rows);
      const batch = db.batch();
      for (const m of moves) {
        batch.update(docSnap.ref.collection('classificacao').doc(m.uid), {
          nivelId: m.paraNivelId,
          pts: 0,
        });
      }
      batch.update(docSnap.ref, {
        'niveis.ultimaMovimentacaoMes': mes,
        atualizadoEm: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      console.log(
        `[movimentacaoRanking] ${docSnap.id} mes=${mes} moves=${moves.length}`
      );
    }
  }
);
