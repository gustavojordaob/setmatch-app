import * as WebBrowser from 'expo-web-browser';
import { auth } from './firebaseConfig';

const REGION = 'southamerica-east1';
const PROJECT = 'setmatch-app-fabrica';
const FN = (name: string) =>
  `https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`;

const CHECKOUT_URL =
  process.env.EXPO_PUBLIC_STRIPE_CHECKOUT_URL ?? FN('criarCheckoutStripe');

const CONFIRM_URL =
  process.env.EXPO_PUBLIC_STRIPE_CONFIRM_URL ?? FN('confirmarCheckoutStripe');

const CONNECT_URL =
  process.env.EXPO_PUBLIC_STRIPE_CONNECT_URL ?? FN('stripeConnectOnboarding');

const CONNECT_STATUS_URL =
  process.env.EXPO_PUBLIC_STRIPE_CONNECT_STATUS_URL ?? FN('stripeConnectStatus');

export type IniciarPagamentoInput = {
  pagamentoId: string;
  titulo: string;
  valor: number;
  ciclo: 'unico' | 'mensal';
  /** Meio escolhido — define métodos no Checkout e subscription vs payment. */
  meio?: 'pix' | 'cartao';
  permitePix?: boolean;
  permiteCartao?: boolean;
  descontoPercent?: number;
  valorBase?: number;
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

export async function iniciarCheckoutStripe(
  input: IniciarPagamentoInput
): Promise<'cancelado' | 'pendente' | 'aprovado'> {
  if (!input.valor || input.valor <= 0) throw new Error('Valor inválido');

  const headers = await authHeaders();
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
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt || 'Falha ao criar checkout Stripe');
  }

  const data = (await resp.json()) as { url?: string; sessionId?: string };
  if (!data.url || !data.sessionId) throw new Error('Checkout sem URL');

  const resultado = await WebBrowser.openBrowserAsync(data.url);

  try {
    const conf = await fetch(CONFIRM_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        sessionId: data.sessionId,
        pagamentoId: input.pagamentoId,
      }),
    });
    if (conf.ok) {
      const body = (await conf.json()) as { status?: string };
      if (body.status === 'aprovado') return 'aprovado';
    }
  } catch {
    // webhook pode completar depois
  }

  return resultado.type === 'cancel' ? 'cancelado' : 'pendente';
}

/** @deprecated use iniciarCheckoutStripe */
export const iniciarCheckoutMercadoPago = iniciarCheckoutStripe;

export async function abrirStripeConnectOnboarding(clubeId: string): Promise<string> {
  const headers = await authHeaders();
  const resp = await fetch(CONNECT_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clubeId }),
  });
  if (!resp.ok) {
    throw new Error((await resp.text()) || 'Falha ao conectar Stripe');
  }
  const data = (await resp.json()) as { url?: string };
  if (!data.url) throw new Error('Link de onboarding ausente');
  await WebBrowser.openBrowserAsync(data.url);
  return data.url;
}

export async function atualizarStripeConnectStatus(clubeId: string): Promise<{
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string;
}> {
  const headers = await authHeaders();
  const resp = await fetch(CONNECT_STATUS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ clubeId }),
  });
  if (!resp.ok) {
    throw new Error((await resp.text()) || 'Falha ao consultar Stripe');
  }
  return resp.json();
}
