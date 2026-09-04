import { Alert, Linking } from 'react-native';
import {
  formatarTelefoneInternacional,
  soDigitos,
  telefoneSalvoValido,
} from './telefoneInternacional';

/** Dígitos com DDI (legado BR sem 55 → adiciona 55). */
export function normalizarTelefoneBR(telefone: string): string {
  const digitos = soDigitos(telefone);
  if (!digitos) return '';
  if (digitos.length >= 12) return digitos;
  if (digitos.length >= 10 && digitos.length <= 11 && !digitos.startsWith('55')) {
    return `55${digitos}`;
  }
  return digitos.startsWith('55') ? digitos : digitos;
}

/** @deprecated use formatarTelefoneInternacional */
export function formatarTelefoneExibicao(telefone: string): string {
  return formatarTelefoneInternacional(telefone);
}

export async function abrirWhatsApp(
  telefone: string,
  mensagem: string
): Promise<void> {
  const phone = normalizarTelefoneBR(telefone);
  if (!phone || !telefoneSalvoValido(phone)) {
    Alert.alert('WhatsApp', 'Telefone inválido ou sem código do país.');
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

/** @deprecated Preferir rota /(auth)/solicitar-acesso */
export async function solicitarContaAdminClube(): Promise<void> {
  const msg =
    'Olá Rally Up! Quero solicitar acesso de *admin de clube*.\n\n' +
    'Nome do clube:\nCidade:\nEsporte:\nTelefone (com código do país):';
  await abrirWhatsApp('5519989632897', msg);
}
