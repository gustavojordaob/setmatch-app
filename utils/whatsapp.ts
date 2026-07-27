import { Alert, Linking } from 'react-native';

/** Só dígitos; adiciona 55 (Brasil) se faltar. */
export function normalizarTelefoneBR(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) return '';
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

export function formatarTelefoneExibicao(telefone: string): string {
  const d = telefone.replace(/\D/g, '').replace(/^55/, '');
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return telefone;
}

export async function abrirWhatsApp(
  telefone: string,
  mensagem: string
): Promise<void> {
  const phone = normalizarTelefoneBR(telefone);
  if (!phone || phone.length < 12) {
    Alert.alert('WhatsApp', 'Telefone inválido ou não cadastrado.');
    return;
  }
  const text = encodeURIComponent(mensagem);
  const appUrl = `whatsapp://send?phone=${phone}&text=${text}`;
  const webUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;
  try {
    const ok = await Linking.canOpenURL(appUrl);
    await Linking.openURL(ok ? appUrl : webUrl);
  } catch {
    Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.');
  }
}

/** Contato Setmatch para solicitar conta admin de clube (não há signup no app). */
export async function solicitarContaAdminClube(): Promise<void> {
  const msg =
    'Olá Setmatch! Quero solicitar acesso de *admin de clube*.\n\n' +
    'Nome do clube:\nCidade:\nEsporte (tênis/padel/beach):\nTelefone:';
  // Canal oficial Setmatch — solicitar conta admin de clube
  await abrirWhatsApp('19989632897', msg);
}
