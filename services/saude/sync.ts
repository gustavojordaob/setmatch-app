import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';
import type { MetricasDispositivo, SaudeResumo } from '../../types/saude';
import {
  isExpoGo,
  lerMetricasHealthConnect,
  lerMetricasHealthKit,
  plataformaSaudeNativa,
} from './dispositivo';

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
  await updateDoc(doc(db, 'usuarios', uid), {
    saude: {
      ...atual,
      ...patch,
      fontes,
      atualizadoEm: serverTimestamp(),
    },
  });
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
    await salvarSaudeResumo(uid, {
      passos: metricas.passos ?? undefined,
      kcalAtivas: metricas.kcalAtivas ?? undefined,
      freqCardiacaMedia: metricas.freqCardiacaMedia ?? undefined,
      sonoMinutos: metricas.sonoMinutos ?? undefined,
      fontes: { appleHealth: true },
    });
    return { metricas, fonte: 'appleHealth' };
  }

  const metricas = await lerMetricasHealthConnect();
  await salvarSaudeResumo(uid, {
    passos: metricas.passos ?? undefined,
    kcalAtivas: metricas.kcalAtivas ?? undefined,
    freqCardiacaMedia: metricas.freqCardiacaMedia ?? undefined,
    sonoMinutos: metricas.sonoMinutos ?? undefined,
    fontes: { healthConnect: true },
  });
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
