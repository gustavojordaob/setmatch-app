import { Alert } from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { iniciarCheckoutStripe } from './stripeCheckout';
import {
  type MeioPagamento,
  type RegrasPrecoPagamento,
  clampDescontoPercent,
  precoPorMeio,
  textoPromoMeio,
} from './precoPagamento';

export type ResultadoCheckoutMeio = 'cancelado' | 'pendente' | 'aprovado' | 'abortado';

/** Texto curto para telas: deixa claro que cartão mensal = recorrência. */
export function textoCicloPagamento(ciclo: 'unico' | 'mensal'): string {
  if (ciclo === 'mensal') {
    return 'Cartão: cobrança automática todo mês. PIX: paga só este mês (sem renovação).';
  }
  return 'Pagamento único (sem renovação automática).';
}

/**
 * Mostra opções PIX / cartão com % de desconto e abre o Stripe.
 * Mensal + cartão = subscription (recorrente). PIX mensal = cobrança única do mês.
 */
export function pagarComEscolhaDeMeio(opts: {
  pagamentoId: string;
  titulo: string;
  ciclo: 'unico' | 'mensal';
  regras: RegrasPrecoPagamento;
}): Promise<ResultadoCheckoutMeio> {
  const { pagamentoId, titulo, ciclo, regras } = opts;
  const permitePix = regras.permitePix !== false;
  const permiteCartao = regras.permiteCartao !== false;
  const promo = textoPromoMeio(regras);

  return new Promise((resolve) => {
    const buttons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve('abortado') }];

    const abrirCheckout = async (meio: MeioPagamento) => {
      const { valorFinal, descontoPercent, valorBase } = precoPorMeio(regras, meio);
      try {
        await updateDoc(doc(db, 'pagamentos', pagamentoId), {
          valor: valorFinal,
          valorBase,
          descontoPercent,
          meioPagamento: meio,
          atualizadoEm: serverTimestamp(),
        });
        const status = await iniciarCheckoutStripe({
          pagamentoId,
          titulo,
          valor: valorFinal,
          ciclo,
          meio,
          permitePix: meio === 'pix',
          permiteCartao: meio === 'cartao',
          descontoPercent,
          valorBase,
        });
        resolve(status);
      } catch (e: unknown) {
        Alert.alert('Pagamento', e instanceof Error ? e.message : 'Falha ao abrir checkout');
        resolve('abortado');
      }
    };

    const addMeio = (meio: MeioPagamento) => {
      const { valorFinal, descontoPercent, valorBase } = precoPorMeio(regras, meio);
      const desc =
        descontoPercent > 0
          ? ` (−${descontoPercent}% de R$ ${valorBase.toFixed(2)})`
          : '';

      const isRecorrente = ciclo === 'mensal' && meio === 'cartao';
      const label = isRecorrente
        ? `Cartão recorrente · R$ ${valorFinal.toFixed(2)}/mês${desc}`
        : meio === 'pix' && ciclo === 'mensal'
          ? `PIX · R$ ${valorFinal.toFixed(2)} (só este mês)${desc}`
          : `${meio === 'pix' ? 'PIX' : 'Cartão'} · R$ ${valorFinal.toFixed(2)}${desc}`;

      buttons.push({
        text: label,
        onPress: () => {
          if (isRecorrente) {
            Alert.alert(
              'Assinatura mensal',
              [
                `Você vai pagar R$ ${valorFinal.toFixed(2)} agora e o mesmo valor será cobrado automaticamente no cartão todo mês.`,
                'É uma assinatura recorrente — cancele depois no clube ou no app se quiser parar.',
                'Continuar para o checkout?',
              ].join('\n\n'),
              [
                { text: 'Voltar', style: 'cancel', onPress: () => resolve('abortado') },
                {
                  text: 'Continuar (recorrente)',
                  onPress: () => void abrirCheckout('cartao'),
                },
              ]
            );
            return;
          }
          void abrirCheckout(meio);
        },
      });
    };

    if (ciclo === 'mensal') {
      if (permiteCartao) addMeio('cartao');
      if (permitePix) addMeio('pix');
    } else {
      if (permitePix) addMeio('pix');
      if (permiteCartao) addMeio('cartao');
    }

    if (buttons.length <= 1) {
      Alert.alert('Pagamento', 'Nenhum meio de pagamento habilitado.');
      resolve('abortado');
      return;
    }

    const msgParts = [
      ciclo === 'mensal'
        ? [
            'IMPORTANTE:',
            '• Cartão = assinatura: cobra todo mês sozinho (recorrência).',
            '• PIX = paga só este mês (não renova).',
          ].join('\n')
        : 'Escolha o meio de pagamento (cobrança única).',
    ];
    if (promo) msgParts.push(promo);

    Alert.alert(
      ciclo === 'mensal' ? 'Mensalidade — como pagar?' : 'Como deseja pagar?',
      msgParts.join('\n\n'),
      buttons
    );
  });
}

export function resumoPromoCurto(regras: RegrasPrecoPagamento): string | null {
  const pix = clampDescontoPercent(regras.descontoPixPercent);
  const card = clampDescontoPercent(regras.descontoCartaoPercent);
  const parts: string[] = [];
  if (regras.permitePix !== false && pix > 0) parts.push(`PIX −${pix}%`);
  if (regras.permiteCartao !== false && card > 0) parts.push(`Cartão −${card}%`);
  return parts.length ? parts.join(' · ') : null;
}
