import type { Href } from 'expo-router';
import type { Ionicons } from '@expo/vector-icons';

export type AdminNavItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Pathname match (prefix) for active state */
  match: string | string[];
  href: (clubeId?: string) => Href;
  /** Só aparece quando há clube */
  needsClube?: boolean;
  /** Só admin_clube (não temporário) */
  hideForTemp?: boolean;
};

export const ADMIN_NAV_PRIMARY: AdminNavItem[] = [
  {
    key: 'painel',
    label: 'Painel',
    icon: 'grid-outline',
    match: '/clube/painel',
    href: () => '/clube/painel',
  },
  {
    key: 'rankings',
    label: 'Rankings',
    icon: 'list-outline',
    match: ['/clube/rankings', '/clube/ranking-'],
    href: () => '/clube/rankings',
    needsClube: true,
  },
  {
    key: 'torneios',
    label: 'Torneios',
    icon: 'trophy-outline',
    match: ['/clube/torneios', '/clube/torneio-'],
    href: () => '/clube/torneios',
    needsClube: true,
  },
  {
    key: 'agenda',
    label: 'Agenda',
    icon: 'tennisball-outline',
    match: '/clube/agenda',
    href: (clubeId) =>
      clubeId
        ? ({ pathname: '/clube/agenda', params: { clubeId } } as Href)
        : '/clube/painel',
    needsClube: true,
  },
  {
    key: 'aulas',
    label: 'Aulas',
    icon: 'school-outline',
    match: ['/clube/aulas-', '/clube/alunos'],
    href: () => '/clube/aulas-publicar',
  },
  {
    key: 'financeiro',
    label: 'Financeiro',
    icon: 'cash-outline',
    match: '/clube/financeiro',
    href: () => '/clube/financeiro',
    needsClube: true,
  },
  {
    key: 'mensagens',
    label: 'Mensagens',
    icon: 'chatbubbles-outline',
    match: '/clube/mensagens',
    href: () => '/clube/mensagens',
  },
  {
    key: 'admins',
    label: 'Admins',
    icon: 'people-outline',
    match: '/clube/admins-temporarios',
    href: () => '/clube/admins-temporarios',
    needsClube: true,
    hideForTemp: true,
  },
];

export const ADMIN_NAV_SECONDARY: AdminNavItem[] = [
  {
    key: 'editar',
    label: 'Editar clube',
    icon: 'create-outline',
    match: '/clube/editar',
    href: (clubeId) =>
      clubeId
        ? ({ pathname: '/clube/editar', params: { id: clubeId } } as Href)
        : '/clube/novo',
  },
  {
    key: 'notificar',
    label: 'Notificar torneio',
    icon: 'mail-outline',
    match: '/clube/torneio-mensagens',
    href: () => '/clube/torneio-mensagens',
    needsClube: true,
  },
  {
    key: 'perfil',
    label: 'Meu perfil',
    icon: 'person-outline',
    match: '/perfil',
    href: () => '/perfil/editar',
  },
];

export function isAdminNavActive(pathname: string, match: string | string[]): boolean {
  const list = Array.isArray(match) ? match : [match];
  return list.some((m) => pathname === m || pathname.startsWith(m));
}
