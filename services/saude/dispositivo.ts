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

function emptyMetrics(): MetricasDispositivo {
  return {
    passos: null,
    kcalAtivas: null,
    freqCardiacaMedia: null,
    sonoMinutos: null,
  };
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

  try {
    const reqStatus = await HK.getRequestStatusForAuthorization({
      toRead: [...HK_READ_TYPES],
    });
    // 1 = shouldRequest — usuário fechou o sheet sem liberar leitura
    if (reqStatus === 1) {
      const err = new Error('APPLE_HEALTH_PERMISSION_INCOMPLETE');
      logErroSaude('apple-health-status', err, 'APPLE_HEALTH_PERMISSION_INCOMPLETE');
      throw err;
    }
    const stepAuth = HK.authorizationStatusFor('HKQuantityTypeIdentifierStepCount');
    // 1 = sharingDenied — negou no Apple Health
    if (stepAuth === 1) {
      const err = new Error('APPLE_HEALTH_PERMISSION_DENIED');
      logErroSaude('apple-health-status', err, 'APPLE_HEALTH_PERMISSION_DENIED');
      throw err;
    }
  } catch (e: unknown) {
    const codigo = e instanceof Error ? e.message : '';
    if (
      codigo === 'APPLE_HEALTH_PERMISSION_INCOMPLETE' ||
      codigo === 'APPLE_HEALTH_PERMISSION_DENIED'
    ) {
      throw e instanceof Error ? e : new Error(codigo);
    }
    /* status opcional — segue se a API falhar em builds antigos */
  }

  const from = startOfToday();
  const to = new Date();

  let passos: number | null = null;
  let kcalAtivas: number | null = null;
  let freqCardiacaMedia: number | null = null;
  let sonoMinutos: number | null = null;

  try {
    const stats = await HK.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { from, to }
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
      { from, to }
    );
    const sum = (stats as { sumQuantity?: { quantity?: number } }).sumQuantity?.quantity;
    if (typeof sum === 'number') kcalAtivas = Math.round(sum);
  } catch {
    /* */
  }

  try {
    const stats = await HK.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierHeartRate',
      ['discreteAverage'],
      { from, to }
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
      { from, to }
    );
    const list = sleep as { startDate: Date; endDate: Date }[];
    sonoMinutos = Math.round(
      list.reduce((a, s) => {
        const ms = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
        return a + Math.max(0, ms) / 60000;
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
