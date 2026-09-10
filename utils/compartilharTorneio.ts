import { Platform, Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

/** Domínio público de share (Rally Up). Env opcional sobrescreve. */
export function getShareBaseUrl(): string {
  const fromEnv =
    process.env.EXPO_PUBLIC_SHARE_BASE_URL?.trim() ||
    process.env.EXPO_PUBLIC_HOSTING_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return 'https://rallyup.app.br';
}

/** Link https da página ponte (abre app ou manda baixar — sem torneio na web). */
export function linkExternoTorneio(torneioId: string): string {
  const base = getShareBaseUrl();
  return `${base}/abrir/torneio?id=${encodeURIComponent(torneioId)}`;
}

export function deepLinkTorneio(torneioId: string): string {
  return `setmatch://torneio/${torneioId}`;
}

async function baixarBannerLocal(
  bannerUrl: string,
  torneioId: string
): Promise<string | null> {
  try {
    const ext = bannerUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
    const dest = new File(Paths.cache, `torneio-banner-${torneioId}.${ext}`);
    const file = await File.downloadFileAsync(bannerUrl, dest, { idempotent: true });
    return file.uri;
  } catch {
    return null;
  }
}

export async function compartilharTorneioFora(input: {
  torneioId: string;
  nome: string;
  clubeNome: string;
  bannerUrl?: string | null;
}): Promise<void> {
  const link = linkExternoTorneio(input.torneioId);
  const mensagem =
    `Torneio ${input.nome} · ${input.clubeNome}\n\n` +
    `Abra no Rally Up (só pelo app):\n${link}`;

  let localBanner: string | null = null;
  if (input.bannerUrl?.startsWith('http')) {
    localBanner = await baixarBannerLocal(input.bannerUrl, input.torneioId);
  }

  // iOS: Share com arquivo local anexa a foto + texto/link.
  // Android: Share nativo não anexa arquivo de forma confiável; o link
  // https://rallyup.app.br/abrir/torneio?id=… carrega og:image (banner) no WhatsApp.
  if (localBanner && Platform.OS === 'ios') {
    await Share.share({
      message: mensagem,
      title: input.nome,
      url: localBanner,
    });
    return;
  }

  await Share.share({
    message: mensagem,
    title: input.nome,
    url: Platform.OS === 'ios' ? link : undefined,
  });
}
