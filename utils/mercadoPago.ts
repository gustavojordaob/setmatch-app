import * as WebBrowser from 'expo-web-browser';
import { auth } from './firebaseConfig';

const FUNCAO_URL =
  process.env.EXPO_PUBLIC_MP_FUNCTION_URL ??
  'https://southamerica-east1-setmatch-app-fabrica.cloudfunctions.net/criarPreferenciaSetmatch';

export type IniciarPagamentoInput = {
  pagamentoId: string;
  titulo: string;
  valor: number;
  /** unico = PIX + cartão 1x; mensal = mesma checkout (renovação manual/ciclo) */
  ciclo: 'unico' | 'mensal';
  permitePix?: boolean;
  permiteCartao?: boolean;
};

export async function iniciarCheckoutMercadoPago(
  input: IniciarPagamentoInput
): Promise<'cancelado' | 'pendente'> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuário não autenticado');
  if (!input.valor || input.valor <= 0) throw new Error('Valor inválido');

  const token = await auth.currentUser!.getIdToken();
  const resp = await fetch(FUNCAO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      uid,
      pagamentoId: input.pagamentoId,
      titulo: input.titulo,
      valor: input.valor,
      ciclo: input.ciclo,
      permitePix: input.permitePix ?? true,
      permiteCartao: input.permiteCartao ?? true,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(txt || 'Falha ao criar preferência Mercado Pago');
  }

  const data = (await resp.json()) as {
    initPoint?: string;
    sandboxInitPoint?: string;
  };

  const url = __DEV__ ? data.sandboxInitPoint || data.initPoint : data.initPoint;
  if (!url) throw new Error('Checkout sem URL de pagamento');

  const resultado = await WebBrowser.openBrowserAsync(url);
  return resultado.type === 'cancel' ? 'cancelado' : 'pendente';
}
