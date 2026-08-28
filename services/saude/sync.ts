import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import type { MetricasDispositivo, SaudeResumo } from '../../types/saude';
import {
  isExpoGo,
  lerMetricasHealthConnect,
  lerMetricasHealthKit,
  plataformaSaudeNativa,
} from './dispositivo';

/** Firestore rejeita `undefined` em qualquer campo. */
function limparUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      // FieldValue / Timestamp — manter; objetos plain aninhados limpar
      const proto = Object.getPrototypeOf(v);
      if (proto === Object.prototype || proto === null) {
        out[k] = limparUndefined(v as Record<string, unknown>);
        continue;
      }
    }
    out[k] = v;
  }
  return out as T;
}

export async function carregarSaudeResumo(uid: string): Promise<SaudeResumo | null> {
  const snap = await getDoc(doc(db, 'usuarios', uid));
  if (!snap.exists()) return null;
  const raw = snap.data().saude as SaudeResumo | undefined;
  return raw ?? null;
}

export async function salvarSaudeResumo(
  uid: string,
  patch: Partial<SaudeResumo>
): Promise<void> {
  const atual = (await carregarSaudeResumo(uid)) ?? {};
  const fontes = { ...(atual.fontes ?? {}), ...(patch.fontes ?? {}) };
  const patchLimpo = limparUndefined({ ...patch } as Record<string, unknown>);
  const merged = limparUndefined({
    ...atual,
    ...patchLimpo,
    fontes,
    atualizadoEm: serverTimestamp(),
  } as Record<string, unknown>);

  await updateDoc(doc(db, 'usuarios', uid), { saude: merged });
}

function patchDeMetricas(
  metricas: MetricasDispositivo,
  fonte: 'appleHealth' | 'healthConnect'
): Partial<SaudeResumo> {
  const patch: Partial<SaudeResumo> = {
    fontes: { [fonte]: true },
  };
  if (metricas.passos != null) patch.passos = metricas.passos;
  if (metricas.kcalAtivas != null) patch.kcalAtivas = metricas.kcalAtivas;
  if (metricas.freqCardiacaMedia != null) {
    patch.freqCardiacaMedia = metricas.freqCardiacaMedia;
  }
  if (metricas.sonoMinutos != null) patch.sonoMinutos = metricas.sonoMinutos;
  return patch;
}

export async function sincronizarDispositivo(
  uid: string
): Promise<{ metricas: MetricasDispositivo; fonte: 'appleHealth' | 'healthConnect' }> {
  const plataforma = plataformaSaudeNativa();
  if (!plataforma || isExpoGo()) {
    throw new Error('NATIVE_HEALTH_REQUIRES_DEV_BUILD');
  }

  if (plataforma === 'ios') {
    const metricas = await lerMetricasHealthKit();
    await salvarSaudeResumo(uid, patchDeMetricas(metricas, 'appleHealth'));
    return { metricas, fonte: 'appleHealth' };
  }

  const metricas = await lerMetricasHealthConnect();
  await salvarSaudeResumo(uid, patchDeMetricas(metricas, 'healthConnect'));
  return { metricas, fonte: 'healthConnect' };
}

export function formatSono(minutos?: number | null): string {
  if (minutos == null || minutos <= 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatNumero(n?: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR');
}
