import { Platform, Share } from 'react-native';

const ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.fabricaapps.setmatch';
const IOS_STORE = 'https://apps.apple.com/app/setmatch';
const WEB_GATE =
  process.env.EXPO_PUBLIC_SHARE_BASE_URL ??
  'https://setmatch-app-fabrica.web.app';

/** Link externo: quem não tem o app precisa instalar para ver o conteúdo. */
export function linkExternoPost(postId: string): string {
  return `${WEB_GATE}/post/${postId}`;
}

export function deepLinkPost(postId: string): string {
  return `setmatch://post/${postId}`;
}

export async function compartilharPostFora(input: {
  postId: string;
  autorNome: string;
  texto: string;
}): Promise<void> {
  const preview = input.texto.trim().slice(0, 120) || 'Publicação no Setmatch';
  const store = Platform.OS === 'ios' ? IOS_STORE : ANDROID_STORE;
  const mensagem =
    `${input.autorNome} no Setmatch:\n"${preview}${input.texto.length > 120 ? '…' : ''}"\n\n` +
    `Para ver a publicação completa, instale o Setmatch:\n${store}\n\n` +
    `Depois abra: ${linkExternoPost(input.postId)}`;

  await Share.share({
    message: mensagem,
    title: 'Compartilhar no Setmatch',
    url: Platform.OS === 'ios' ? linkExternoPost(input.postId) : undefined,
  });
}
