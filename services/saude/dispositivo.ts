import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { MetricasDispositivo } from '../../types/saude';
import { classificarErroHealthConnect, logErroSaude, type SaudeErroCodigo } from './errosSaude';

const HK_READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function plataformaSaudeNativa(): 'ios' | 'android' | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return null;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Filtro de hoje no formato da lib v14+ (`filter.date`, não `{ from, to }`). */
function filtroHoje() {
  return {
    filter: {
      date: {
        startDate: startOfToday(),
        endDate: new Date(),
      },
    },
  };
}

function emptyMetrics(): MetricasDispositivo {
  return {
    passos: null,
    kcalAtivas: null,
    freqCardiacaMedia: null,
    sonoMinutos: null,
  };
}

/** Normaliza energia para kcal (preferred unit do iOS pode ser J / cal). */
function quantidadeParaKcal(q?: { quantity?: number; unit?: string } | null): number | null {
  if (!q || typeof q.quantity !== 'number' || !Number.isFinite(q.quantity)) return null;
  const unit = (q.unit ?? '').trim();
  const v = q.quantity;
  if (unit === 'kcal' || unit === 'Cal') return Math.round(v);
  if (unit === 'cal') return Math.round(v / 1000);
  if (unit === 'J' || unit === 'kJ' || unit.endsWith('J')) {
    // 1 kcal ≈ 4184 J; se vier kJ, 1 kcal ≈ 4.184 kJ
    if (unit === 'kJ') return Math.round(v / 4.184);
    return Math.round(v / 4184);
  }
  // Sem unit conhecida: valores absurdos para 1 dia → assume joules
  if (v > 20000) return Math.round(v / 4184);
  return Math.round(v);
}

/** HealthKit — só iOS + dev build (não Expo Go). */
export async function lerMetricasHealthKit(): Promise<MetricasDispositivo> {
  if (Platform.OS !== 'ios' || isExpoGo()) {
    throw new Error('APPLE_HEALTH_UNAVAILABLE');
  }

  let HK: typeof import('@kingstinct/react-native-healthkit');
  try {
    HK = await import('@kingstinct/react-native-healthkit');
  } catch {
    throw new Error('APPLE_HEALTH_UNAVAILABLE');
  }

  let available = false;
  try {
    available = await HK.isHealthDataAvailable();
  } catch {
    throw new Error('APPLE_HEALTH_UNAVAILABLE');
  }
  if (!available) throw new Error('APPLE_HEALTH_UNAVAILABLE');

  try {
    await HK.requestAuthorization({ toRead: [...HK_READ_TYPES] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/denied|cancel|not authorized|authorization/i.test(msg)) {
      logErroSaude('apple-health-auth', e, 'APPLE_HEALTH_PERMISSION_DENIED');
      throw new Error('APPLE_HEALTH_PERMISSION_DENIED');
    }
    logErroSaude('apple-health-auth', e, 'APPLE_HEALTH_AUTH_FAILED');
    throw new Error('APPLE_HEALTH_AUTH_FAILED');
  }

  /**
   * Apple NÃO revela se a leitura foi liberada ou negada (privacidade).
   * `authorizationStatusFor` só reflete permissão de ESCRITA — como não pedimos
   * write, sempre vinha `sharingDenied` e o app acusava acesso negado à toa.
   * Só checamos se ainda precisamos pedir o sheet (`shouldRequest`).
   */
  try {
    const reqStatus = await HK.getRequestStatusForAuthorization({
      toRead: [...HK_READ_TYPES],
    });
    // 1 = shouldRequest — sheet ainda não foi concluído / tipos não autorizados a pedir
    if (reqStatus === 1) {
      const err = new Error('APPLE_HEALTH_PERMISSION_INCOMPLETE');
      logErroSaude('apple-health-status', err, 'APPLE_HEALTH_PERMISSION_INCOMPLETE');
      throw err;
    }
  } catch (e: unknown) {
    const codigo = e instanceof Error ? e.message : '';
    if (codigo === 'APPLE_HEALTH_PERMISSION_INCOMPLETE') {
      throw e instanceof Error ? e : new Error(codigo);
    }
    /* status opcional — segue se a API falhar em builds antigos */
  }

  const hoje = filtroHoje();

  let passos: number | null = null;
  let kcalAtivas: number | null = null;
  let freqCardiacaMedia: number | null = null;
  let sonoMinutos: number | null = null;

  try {
    const stats = await HK.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { ...hoje, unit: 'count' }
    );
    const sum = (stats as { sumQuantity?: { quantity?: number } }).sumQuantity?.quantity;
    if (typeof sum === 'number') passos = Math.round(sum);
  } catch {
    /* */
  }

  try {
    const stats = await HK.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      ['cumulativeSum'],
      { ...hoje, unit: 'kcal' }
    );
    const sumQ = (stats as { sumQuantity?: { quantity?: number; unit?: string } })
      .sumQuantity;
    kcalAtivas = quantidadeParaKcal(sumQ);
  } catch {
    /* */
  }

  try {
    const stats = await HK.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierHeartRate',
      ['discreteAverage'],
      { ...hoje, unit: 'count/min' }
    );
    const avg = (stats as { averageQuantity?: { quantity?: number } }).averageQuantity
      ?.quantity;
    if (typeof avg === 'number') freqCardiacaMedia = Math.round(avg);
  } catch {
    /* */
  }

  try {
    const sleep = await HK.queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      { ...hoje, limit: 0 }
    );
    const list = sleep as { startDate: Date; endDate: Date }[];
    const inicio = startOfToday().getTime();
    const fim = Date.now();
    sonoMinutos = Math.round(
      list.reduce((a, s) => {
        const start = new Date(s.startDate).getTime();
        const end = new Date(s.endDate).getTime();
        // Intersecta o intervalo de sono com o dia de hoje
        const lo = Math.max(start, inicio);
        const hi = Math.min(end, fim);
        return a + Math.max(0, hi - lo) / 60000;
      }, 0)
    );
  } catch {
    /* */
  }

  return { passos, kcalAtivas, freqCardiacaMedia, sonoMinutos };
}

/** Health Connect — Android (substitui Google Fit). */
export async function lerMetricasHealthConnect(): Promise<MetricasDispositivo> {
  if (Platform.OS !== 'android' || isExpoGo()) {
    throw new Error('HEALTH_CONNECT_UNAVAILABLE');
  }

  let HC: typeof import('react-native-health-connect');
  try {
    HC = await import('react-native-health-connect');
  } catch {
    throw new Error('HEALTH_CONNECT_UNAVAILABLE');
  }

  let ok = false;
  try {
    ok = await HC.initialize();
  } catch {
    throw new Error('HEALTH_CONNECT_INIT_FAILED');
  }
  if (!ok) throw new Error('HEALTH_CONNECT_INIT_FAILED');

  const status = await HC.getSdkStatus();
  const available =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HC as any).SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
  if (status !== available) {
    throw new Error('HEALTH_CONNECT_NOT_INSTALLED');
  }

  const jaTemPassos = async () => {
    const granted = await HC.getGrantedPermissions();
    return granted.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
  };

  try {
    // Se o usuário já liberou no app Health Connect, não abre o diálogo nativo
    // (no POCO o ActivityResultLauncher quebra após a Activity ser recriada).
    if (!(await jaTemPassos())) {
      await HC.requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
      ]);
    }
    try {
      await HC.requestPermission([
        { accessType: 'read', recordType: 'HeartRate' },
        { accessType: 'read', recordType: 'SleepSession' },
      ]);
    } catch {
      /* opcional — app segue só com passos/kcal */
    }

    if (!(await jaTemPassos())) {
      throw new Error('HEALTH_CONNECT_PERMISSION_DENIED');
    }
  } catch (e: unknown) {
    const codigo =
      e instanceof Error && e.message.startsWith('HEALTH_CONNECT_')
        ? (e.message as SaudeErroCodigo)
        : null;
    if (codigo === 'HEALTH_CONNECT_PERMISSION_DENIED') {
      logErroSaude('health-connect-permissao-negada', e, codigo);
      throw e instanceof Error ? e : new Error(codigo);
    }
    const classificado = classificarErroHealthConnect(e);
    logErroSaude('health-connect-permissao', e, classificado);
    throw new Error(classificado);
  }

  const startTime = startOfToday().toISOString();
  const endTime = new Date().toISOString();
  const filter = {
    timeRangeFilter: { operator: 'between' as const, startTime, endTime },
  };

  const out = emptyMetrics();

  try {
    const steps = await HC.readRecords('Steps', filter);
    out.passos = Math.round(
      (steps.records as { count: number }[]).reduce((a, r) => a + (r.count || 0), 0)
    );
  } catch {
    /* */
  }

  try {
    const cal = await HC.readRecords('ActiveCaloriesBurned', filter);
    out.kcalAtivas = Math.round(
      (cal.records as { energy: { inKilocalories?: number } }[]).reduce(
        (a, r) => a + (r.energy?.inKilocalories || 0),
        0
      )
    );
  } catch {
    /* */
  }

  try {
    const hr = await HC.readRecords('HeartRate', filter);
    const samples = (hr.records as { samples?: { beatsPerMinute: number }[] }[]).flatMap(
      (r) => r.samples ?? []
    );
    if (samples.length > 0) {
      out.freqCardiacaMedia = Math.round(
        samples.reduce((a, s) => a + s.beatsPerMinute, 0) / samples.length
      );
    }
  } catch {
    /* */
  }

  try {
    const sleep = await HC.readRecords('SleepSession', filter);
    out.sonoMinutos = Math.round(
      (sleep.records as { startTime: string; endTime: string }[]).reduce((a, r) => {
        const ms = new Date(r.endTime).getTime() - new Date(r.startTime).getTime();
        return a + Math.max(0, ms) / 60000;
      }, 0)
    );
  } catch {
    /* */
  }

  return out;
}
