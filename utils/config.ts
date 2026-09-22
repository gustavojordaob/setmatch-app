import { HOSTING_BASE_URL } from '../constants/legal';

/**
 * URL da Cloud Function excluirConta.
 * Preferir EXPO_PUBLIC_EXCLUIR_CONTA_URL no .env.
 */
export function getExcluirContaUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_EXCLUIR_CONTA_URL?.trim();
  if (fromEnv) return fromEnv;
  return 'https://southamerica-east1-setmatch-app-fabrica.cloudfunctions.net/excluirConta';
}

export function getHostingBaseUrl(): string {
  return process.env.EXPO_PUBLIC_HOSTING_URL?.trim() || HOSTING_BASE_URL;
}

/** Cloud Function buscarQuadrasMaps (Google Places). */
export function getBuscarQuadrasMapsUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_BUSCAR_QUADRAS_URL?.trim();
  if (fromEnv) return fromEnv;
  return 'https://southamerica-east1-setmatch-app-fabrica.cloudfunctions.net/buscarQuadrasMaps';
}
