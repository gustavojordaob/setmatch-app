/**
 * @deprecated Use utils/stripeCheckout — Mercado Pago substituído por Stripe.
 */
export {
  iniciarCheckoutStripe as iniciarCheckoutMercadoPago,
  iniciarCheckoutStripe,
  abrirStripeConnectOnboarding,
  atualizarStripeConnectStatus,
  type IniciarPagamentoInput,
} from './stripeCheckout';
