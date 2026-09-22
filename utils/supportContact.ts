import { SUPPORT_PHONE_E164, SUPPORT_WHATSAPP_MESSAGE } from '../constants/support';
import { abrirWhatsApp } from './whatsapp';

export async function openSupportWhatsApp(
  mensagem: string = SUPPORT_WHATSAPP_MESSAGE
): Promise<void> {
  await abrirWhatsApp(SUPPORT_PHONE_E164, mensagem);
}
