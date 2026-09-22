/**
 * @deprecated Use utils/asaasCheckout — Stripe substituído por Asaas.
 */
export {
  iniciarCheckoutAsaas as iniciarCheckoutStripe,
  iniciarCheckoutAsaas,
  iniciarCheckoutMercadoPago,
  abrirStripeConnectOnboarding,
  atualizarStripeConnectStatus,
  consultarSaldoFinanceiro,
  salvarChavePixDono,
  transferirSaldoPix,
  liberarPagamentoViaApi,
  type IniciarPagamentoInput,
  type SaldoFinanceiro,
} from './asaasCheckout';
