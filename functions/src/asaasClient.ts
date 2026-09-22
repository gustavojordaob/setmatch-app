import { defineString } from 'firebase-functions/params';

export const asaasApiKey = defineString('ASAAS_API_KEY', { default: '' });
/** Token do webhook Asaas (header `asaas-access-token`). */
export const asaasWebhookToken = defineString('ASAAS_WEBHOOK_TOKEN', { default: '' });
/** Comissão da plataforma Rally Up em % (0–100), além da tarifa Asaas.
 * O líquido do dono usa preferencialmente `netValue` da cobrança Asaas (já sem tarifa Asaas).
 * Este % só entra como fallback quando netValue não está disponível. */
export const asaasFeePercent = defineString('ASAAS_PLATFORM_FEE_PERCENT', { default: '0' });

export function asaasBaseUrl(): string {
  const key = asaasApiKey.value();
  if (key.includes('_hmlg_') || key.includes('_test_')) {
    return 'https://api-sandbox.asaas.com';
  }
  return 'https://api.asaas.com';
}

export function asaasCheckoutHost(): string {
  const key = asaasApiKey.value();
  if (key.includes('_hmlg_') || key.includes('_test_')) {
    return 'https://sandbox.asaas.com';
  }
  return 'https://asaas.com';
}

export function requireAsaasKey(): string {
  const key = asaasApiKey.value()?.trim();
  if (!key) throw new Error('ASAAS_API_KEY não configurado em functions/.env');
  return key;
}

export async function asaasFetch<T = Record<string, unknown>>(
  path: string,
  init?: { method?: string; body?: unknown; query?: Record<string, string> }
): Promise<T> {
  const key = requireAsaasKey();
  const qs = init?.query
    ? '?' +
      Object.entries(init.query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
    : '';
  const url = `${asaasBaseUrl()}${path}${qs}`;
  const resp = await fetch(url, {
    method: init?.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      'User-Agent': 'RallyUp/1.0',
    },
    body: init?.body != null ? JSON.stringify(init.body) : undefined,
  });
  const text = await resp.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!resp.ok) {
    const errObj = data as { errors?: { description?: string }[]; message?: string };
    const desc =
      errObj.errors?.[0]?.description ||
      errObj.message ||
      text.slice(0, 300) ||
      `Asaas HTTP ${resp.status}`;
    throw new Error(desc);
  }
  return data as T;
}

export function feeAmount(valor: number): number {
  const pct = Math.max(0, Math.min(100, Number(asaasFeePercent.value() || 0)));
  return Math.round(valor * (pct / 100) * 100) / 100;
}

export function netToDono(valor: number): number {
  return Math.round((valor - feeAmount(valor)) * 100) / 100;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
