import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { MetricasDispositivo } from '../../types/saude';

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
  // Import dinâmico: evita crash no Expo Go / web
  const HK = await import('@kingstinct/react-native-healthkit');
  const available = await HK.isHealthDataAvailable();
  if (!available) throw new Error('APPLE_HEALTH_UNAVAILABLE');

  await HK.requestAuthorization({
    toRead: [
      'HKQuantityTypeIdentifierStepCount',
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      'HKQuantityTypeIdentifierHeartRate',
      'HKCategoryTypeIdentifierSleepAnalysis',
    ],
  });

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

  const HC = await import('react-native-health-connect');
  const ok = await HC.initialize();
  if (!ok) throw new Error('HEALTH_CONNECT_UNAVAILABLE');

  const status = await HC.getSdkStatus();
  const available =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (HC as any).SdkAvailabilityStatus?.SDK_AVAILABLE ?? 3;
  if (status !== available) {
    throw new Error('HEALTH_CONNECT_NOT_INSTALLED');
  }

  await HC.requestPermission([
    { accessType: 'read', recordType: 'Steps' },
    { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
    { accessType: 'read', recordType: 'HeartRate' },
    { accessType: 'read', recordType: 'SleepSession' },
  ]);

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
