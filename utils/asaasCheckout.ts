import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { auth } from './firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

const REGION = 'southamerica-east1';
const PROJECT = 'setmatch-app-fabrica';
const FN = (name: string) =>
  `https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`;

const CHECKOUT_URL =
  process.env.EXPO_PUBLIC_ASAAS_CHECKOUT_URL ?? FN('criarCheckoutAsaas');
const CONFIRM_URL =
  process.env.EXPO_PUBLIC_ASAAS_CONFIRM_URL ?? FN('confirmarCheckoutAsaas');
const SALDO_URL =
  process.env.EXPO_PUBLIC_ASAAS_SALDO_URL ?? FN('consultarSaldoFinanceiro');
const PIX_URL =
  process.env.EXPO_PUBLIC_ASAAS_PIX_URL ?? FN('salvarChavePixDono');
const TRANSFER_URL =
  process.env.EXPO_PUBLIC_ASAAS_TRANSFER_URL ?? FN('transferirSaldoPix');
const LIBERAR_URL =
  process.env.EXPO_PUBLIC_ASAAS_LIBERAR_URL ?? FN('liberarPagamentoDono');

export type IniciarPagamentoInput = {
  pagamentoId: string;
  titulo: string;
  valor: number;
  ciclo: 'unico' | 'mensal';
  meio?: 'pix' | 'cartao';
  permitePix?: boolean;
  permiteCartao?: boolean;
  descontoPercent?: number;
  valorBase?: number;
};

export type SaldoFinanceiro = {
  /** Já líquido e liberado na Asaas — pode transferir PIX. */
  saldoDisponivel: number;
  /** Líquido creditado (cartão confirmado) ainda aguardando RECEIVED/antecipação. */
  saldoALiberar?: number;
  saldoTotalRecebido: number;
  saldoTransferido: number;
  /** Contrato da API: true = campos de saldo estão em líquido. */
  valoresEmLiquido?: boolean;
  /** Saldo na conta Asaas da plataforma (única; professor não cria conta). */
  saldoAsaasPlataforma?: number | null;
  porModalidade: Record<string, { recebido: number; qtd: number }>;
  porTipo: Record<string, number>;
  pixTipo: string | null;
  pixChave: string | null;
  provedor: string;
};

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function confirmarELiberar(
  headers: Record<string, string>,
  checkoutId: string,
  pagamentoId: string
): Promise<'aprovado' | 'pendente'> {
  try {
    const conf = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ checkoutId, sessionId: checkoutId, pagamentoId }),
    });
    if (!conf.ok) return 'pendente';
    const body = (await conf.json()) as { status?: string };
    if (body.status !== 'aprovado') return 'pendente';

    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('./firebaseConfig');
      const pagSnap = await getDoc(doc(db, 'pagamentos', pagamentoId));
      const pag = pagSnap.data();
      if (pag?.tipo === 'torneio' && pag.torneioId && pag.uid) {
        const { marcarPagamentoInscricaoTorneio } = await import('../services/duplas');
        await marcarPagamentoInscricaoTorneio({
          torneioId: String(pag.torneioId),
          uid: String(pag.uid),
          pagamentoId,
        });
      }
    } catch (e) {
      console.warn('[asaas] liberar inscrição pós-pago', e);
    }
    return 'aprovado';
  } catch {
    return 'pendente';
  }
}

export async function iniciarCheckoutAsaas(
  input: IniciarPagamentoInput
): Promise<'cancelado' | 'pendente' | 'aprovado'> {
  if (!input.valor || input.valor <= 0) throw new Error('Valor inválido');

  const headers = await authHeaders();
  const emailAuth = auth.currentUser?.email?.trim().toLowerCase() || undefined;
  const resp = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pagamentoId: input.pagamentoId,
      titulo: input.titulo,
      valor: input.valor,
      ciclo: input.ciclo,
      meio: input.meio,
      permitePix: input.permitePix ?? true,
      permiteCartao: input.permiteCartao ?? true,
      descontoPercent: input.descontoPercent ?? 0,
      valorBase: input.valorBase,
      ...(emailAuth ? { email: emailAuth } : {}),
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    let msg = txt || 'Falha ao criar checkout Asaas';
    try {
      const j = JSON.parse(txt) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* texto puro */
    }
    throw new Error(msg.slice(0, 280));
  }

  const data = (await resp.json()) as {
    url?: string;
    sessionId?: string;
    checkoutId?: string;
  };
  const checkoutId = data.checkoutId || data.sessionId;
  if (!data.url || !checkoutId) throw new Error('Checkout sem URL');

  const redirectUrl = Linking.createURL('pagamento/sucesso');
  let authDismissedAsCancel = false;

  try {
    const resultado = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl, {
      showInRecents: true,
      preferEphemeralSession: false,
      ...(Platform.OS === 'ios' ? { dismissButtonStyle: 'close' as const } : {}),
    });
    authDismissedAsCancel = resultado.type === 'cancel';
  } catch (e) {
    console.warn('[asaas] openAuthSessionAsync falhou, fallback browser', e);
    const browser = await WebBrowser.openBrowserAsync(data.url, {
      enableBarCollapsing: true,
      showInRecents: true,
    });
    authDismissedAsCancel = browser.type === 'cancel';
  }

  const status = await confirmarELiberar(headers, checkoutId, input.pagamentoId);
  if (status === 'aprovado') return 'aprovado';
  if (authDismissedAsCancel) return 'cancelado';
  return 'pendente';
}

/** @deprecated alias — Stripe removido */
export const iniciarCheckoutStripe = iniciarCheckoutAsaas;
/** @deprecated */
export const iniciarCheckoutMercadoPago = iniciarCheckoutAsaas;

export async function consultarSaldoFinanceiro(): Promise<SaldoFinanceiro> {
  const headers = await authHeaders();
  const resp = await fetch(SALDO_URL, { method: 'POST', headers, body: '{}' });
  if (!resp.ok) throw new Error((await resp.text()) || 'Falha ao consultar saldo');
  return resp.json();
}

export async function salvarChavePixDono(input: {
  pixTipo: string;
  pixChave: string;
}): Promise<void> {
  const headers = await authHeaders();
  const resp = await fetch(PIX_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const j = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || 'Falha ao salvar chave PIX');
  }
}

export async function transferirSaldoPix(input: {
  valor?: number;
  tudo?: boolean;
  pixTipo?: string;
  pixChave?: string;
}): Promise<{ transferenciaId: string; status?: string }> {
  const headers = await authHeaders();
  const resp = await fetch(TRANSFER_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const body = (await resp.json().catch(() => ({}))) as {
    error?: string;
    transferenciaId?: string;
    status?: string;
  };
  if (!resp.ok) throw new Error(body.error || 'Falha na transferência');
  return {
    transferenciaId: String(body.transferenciaId || ''),
    status: body.status,
  };
}

export async function liberarPagamentoViaApi(pagamentoId: string): Promise<void> {
  const headers = await authHeaders();
  const resp = await fetch(LIBERAR_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pagamentoId }),
  });
  if (!resp.ok) {
    const j = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || 'Falha ao liberar');
  }
}

/** @deprecated Stripe Connect removido — Asaas não exige conta do professor. */
export async function abrirStripeConnectOnboarding(_clubeId: string): Promise<string> {
  throw new Error('Stripe removido. Use transferência PIX no Financeiro.');
}

/** @deprecated */
export async function atualizarStripeConnectStatus(_clubeId: string): Promise<{
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string;
}> {
  return {
    connected: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
  };
}
