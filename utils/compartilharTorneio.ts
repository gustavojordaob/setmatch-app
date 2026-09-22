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

/**
 * Compartilha torneio. No WhatsApp o preview do banner vem do og:image do link.
 * No Android NÃO anexar arquivo — isso impede o unfurl do link.
 * No iOS anexa o banner quando der (além do texto/link).
 */
export async function compartilharTorneioFora(input: {
  torneioId: string;
  nome: string;
  clubeNome: string;
  bannerUrl?: string | null;
}): Promise<void> {
  const link = linkExternoTorneio(input.torneioId);
  // URL sozinha na última linha → WhatsApp gera preview (og:image).
  const mensagem =
    `Torneio ${input.nome} · ${input.clubeNome}\n` +
    `Abra no Rally Up (só pelo app):\n` +
    `${link}`;

  if (Platform.OS === 'ios' && input.bannerUrl?.startsWith('http')) {
    const localBanner = await baixarBannerLocal(input.bannerUrl, input.torneioId);
    if (localBanner) {
      try {
        await Share.share({
          message: mensagem,
          title: input.nome,
          url: localBanner,
        });
        return;
      } catch {
        /* cai no share só com texto */
      }
    }
  }

  await Share.share({
    message: mensagem,
    title: input.nome,
    url: Platform.OS === 'ios' ? link : undefined,
  });
}
