import { Platform } from 'react-native';
import type { TranslateFn } from '../../i18n/types';

/** Códigos estáveis — message do Error; mapeados para i18n na UI. */
export const SAUDE_ERROS = [
  'NATIVE_HEALTH_REQUIRES_DEV_BUILD',
  'HEALTH_CONNECT_UNAVAILABLE',
  'HEALTH_CONNECT_INIT_FAILED',
  'HEALTH_CONNECT_NOT_INSTALLED',
  'HEALTH_CONNECT_PERMISSION_DENIED',
  'HEALTH_CONNECT_NATIVE_LAUNCHER',
  'HEALTH_CONNECT_NATIVE_DELEGATE',
  'HEALTH_CONNECT_PERMISSION_REQUEST_FAILED',
  'APPLE_HEALTH_UNAVAILABLE',
  'APPLE_HEALTH_PERMISSION_DENIED',
  'APPLE_HEALTH_PERMISSION_INCOMPLETE',
  'APPLE_HEALTH_AUTH_FAILED',
] as const;

export type SaudeErroCodigo = (typeof SAUDE_ERROS)[number];

const CODIGOS = new Set<string>(SAUDE_ERROS);

export function extrairCodigoErroSaude(e: unknown): SaudeErroCodigo | null {
  if (!(e instanceof Error)) return null;
  return CODIGOS.has(e.message) ? (e.message as SaudeErroCodigo) : null;
}

export function classificarErroHealthConnect(raw: unknown): SaudeErroCodigo {
  const msg = raw instanceof Error ? raw.message : String(raw);
  if (/unregistered ActivityResultLauncher/i.test(msg)) {
    return 'HEALTH_CONNECT_NATIVE_LAUNCHER';
  }
  if (
    /PermissionDelegate|HealthConnectPermissionDelegate|lateinit|not initialized/i.test(
      msg
    )
  ) {
    return 'HEALTH_CONNECT_NATIVE_DELEGATE';
  }
  if (/cancel|denied|permission denied|user denied/i.test(msg)) {
    return 'HEALTH_CONNECT_PERMISSION_DENIED';
  }
  if (/requestPermission|permission/i.test(msg)) {
    return 'HEALTH_CONNECT_PERMISSION_REQUEST_FAILED';
  }
  return 'HEALTH_CONNECT_PERMISSION_REQUEST_FAILED';
}

export function alertaErroSaude(
  codigo: SaudeErroCodigo,
  t: TranslateFn
): { title: string; body: string } {
  switch (codigo) {
    case 'NATIVE_HEALTH_REQUIRES_DEV_BUILD':
      return {
        title: t('saude.needsDevBuildTitle'),
        body: t('saude.needsDevBuildBody'),
      };
    case 'HEALTH_CONNECT_UNAVAILABLE':
      return {
        title: t('saude.healthConnect'),
        body: t('saude.hcUnavailableBody'),
      };
    case 'HEALTH_CONNECT_INIT_FAILED':
      return {
        title: t('saude.healthConnect'),
        body: t('saude.hcInitFailedBody'),
      };
    case 'HEALTH_CONNECT_NOT_INSTALLED':
      return {
        title: t('saude.hcMissingTitle'),
        body: t('saude.hcMissingBody'),
      };
    case 'HEALTH_CONNECT_PERMISSION_DENIED':
      return {
        title: t('saude.hcMissingTitle'),
        body: t('saude.hcPermissionDeniedBody'),
      };
    case 'HEALTH_CONNECT_NATIVE_LAUNCHER':
      return {
        title: t('saude.hcNativeSetupTitle'),
        body: t('saude.hcNativeLauncherBody'),
      };
    case 'HEALTH_CONNECT_NATIVE_DELEGATE':
      return {
        title: t('saude.hcNativeSetupTitle'),
        body: t('saude.hcNativeDelegateBody'),
      };
    case 'HEALTH_CONNECT_PERMISSION_REQUEST_FAILED':
      return {
        title: t('saude.hcMissingTitle'),
        body: t('saude.hcPermissionRequestFailedBody'),
      };
    case 'APPLE_HEALTH_UNAVAILABLE':
      return {
        title: t('saude.appleHealth'),
        body: t('saude.ahUnavailableBody'),
      };
    case 'APPLE_HEALTH_PERMISSION_DENIED':
      return {
        title: t('saude.appleHealth'),
        body: t('saude.ahPermissionDeniedBody'),
      };
    case 'APPLE_HEALTH_PERMISSION_INCOMPLETE':
      return {
        title: t('saude.appleHealth'),
        body: t('saude.ahPermissionIncompleteBody'),
      };
    case 'APPLE_HEALTH_AUTH_FAILED':
      return {
        title: t('saude.appleHealth'),
        body: t('saude.ahAuthFailedBody'),
      };
    default:
      return {
        title: t('saude.title'),
        body: t('saude.syncFailed'),
      };
  }
}

export function logErroSaude(
  contexto: string,
  e: unknown,
  codigoExplicito?: SaudeErroCodigo | null
): SaudeErroCodigo | null {
  const codigo = codigoExplicito ?? extrairCodigoErroSaude(e);
  const raw = e instanceof Error ? e.message : String(e);
  const causa =
    e instanceof Error && e.cause instanceof Error
      ? e.cause.message
      : undefined;

  console.warn(`[RallyUp/Saude] ${contexto}`, {
    plataforma: Platform.OS,
    codigo: codigo ?? 'DESCONHECIDO',
    mensagem: raw,
    causa,
  });

  if (__DEV__ && e instanceof Error && e.stack) {
    console.warn(e.stack);
  }

  return codigo;
}

export function alertaErroSaudeDesconhecido(
  e: unknown,
  t: TranslateFn,
  contexto = 'saude'
): { title: string; body: string } {
  logErroSaude(contexto, e);
  const codigo = extrairCodigoErroSaude(e);
  if (codigo) return alertaErroSaude(codigo, t);
  const detail =
    e instanceof Error && e.message.trim()
      ? e.message.trim().slice(0, 160)
      : '';
  return {
    title: t('saude.title'),
    body: detail
      ? t('saude.errorUnexpectedBody', { detail })
      : t('saude.syncFailed'),
  };
}
