import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import {
  ADMIN_NAV_PRIMARY,
  ADMIN_NAV_SECONDARY,
  isAdminNavActive,
  type AdminNavItem,
} from '../../constants/adminNav';
import { useAuth } from '../../hooks/useAuth';
import { useContagemNaoLidas } from '../../hooks/useTotalNaoLidas';
import { listarClubesDoDono } from '../../services/clubes';
import { adminLogoutPath } from '../../utils/adminWeb';
import { UnreadBadge } from '../ui/UnreadBadge';

const SIDEBAR_W = 260;
const BREAKPOINT = 960;

type Props = { children: ReactNode };

export function AdminDesktopShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { width } = useWindowDimensions();
  const { user, perfil, signOut, isAdminClube } = useAuth();
  const { mensagens: msgsUnread, notificacoes: notifsUnread, total: badgeSino } =
    useContagemNaoLidas();
  const [clubeId, setClubeId] = useState<string | undefined>();
  const [clubeNome, setClubeNome] = useState<string | undefined>();
  const [clubReady, setClubReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = width >= BREAKPOINT;

  const carregarClube = useCallback(async () => {
    if (!user) return;
    setClubReady(false);
    try {
      const list = await listarClubesDoDono(user.uid);
      setClubeId(list[0]?.id);
      setClubeNome(list[0]?.nome);
    } catch {
      setClubeId(undefined);
      setClubeNome(undefined);
    } finally {
      setClubReady(true);
    }
  }, [user]);

  useEffect(() => {
    void carregarClube();
  }, [carregarClube, pathname]);

  // Web: se já tem clube e caiu em /clube/novo (race do menu), volta ao painel
  useEffect(() => {
    if (Platform.OS !== 'web' || !clubReady || !clubeId) return;
    const onNovo =
      pathname === '/clube/novo' ||
      pathname.endsWith('/clube/novo') ||
      pathname.includes('/clube/novo');
    if (onNovo) {
      router.replace('/clube/painel');
    }
  }, [clubReady, clubeId, pathname, router]);

  if (Platform.OS !== 'web' || !isAdminClube) {
    return <>{children}</>;
  }

  const isTemp = perfil?.role === 'admin_temporario';
  const title =
    perfil?.role === 'professor' ? 'Painel do professor' : 'Painel do clube';

  function go(item: AdminNavItem) {
    if (item.needsClube && !clubeId) {
      // Evita mandar para "Cadastrar clube" antes de saber se o clube já existe
      if (!clubReady) return;
      router.push('/clube/novo');
      setDrawerOpen(false);
      return;
    }
    router.push(item.href(clubeId));
    setDrawerOpen(false);
  }

  function visible(items: AdminNavItem[]) {
    return items.filter((item) => {
      if (item.hideForTemp && isTemp) return false;
      if (item.needsClube && !clubeId && item.key !== 'editar') return false;
      return true;
    });
  }

  async function onLogout() {
    await signOut();
    router.replace(adminLogoutPath());
  }

  const sidebar = (
    <View style={[styles.sidebar, !wide && styles.sidebarDrawer]}>
      <View style={styles.brandRow}>
        <Image
          source={require('../../assets/Vector.png')}
          style={styles.brandLogo}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.brandName}>Rally Up</Text>
          <Text style={styles.brandSub}>Admin · web</Text>
        </View>
      </View>

      {clubeNome ? (
        <Text style={styles.clubeChip} numberOfLines={1}>
          {clubeNome}
        </Text>
      ) : (
        <Pressable style={styles.clubeChipEmpty} onPress={() => router.push('/clube/novo')}>
          <Text style={styles.clubeChipEmptyTxt}>Cadastrar clube</Text>
        </Pressable>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.navScroll}>
        {visible(ADMIN_NAV_PRIMARY).map((item) => {
          const active = isAdminNavActive(pathname, item.match);
          const badge =
            item.key === 'mensagens' ? msgsUnread : item.key === 'painel' ? badgeSino : 0;
          return (
            <Pressable
              key={item.key}
              onPress={() => go(item)}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? Colors.textOnAccent : Colors.white}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              <UnreadBadge count={badge} />
            </Pressable>
          );
        })}

        <Text style={styles.navSection}>Mais</Text>
        {visible(ADMIN_NAV_SECONDARY).map((item) => {
          const active = isAdminNavActive(pathname, item.match);
          return (
            <Pressable
              key={item.key}
              onPress={() => go(item)}
              style={[styles.navItem, active && styles.navItemActive]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? Colors.textOnAccent : Colors.white}
              />
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sidebarFoot}>
        <Text style={styles.userName} numberOfLines={1}>
          {perfil?.nome || user?.email || 'Admin'}
        </Text>
        <Pressable style={styles.logoutBtn} onPress={() => void onLogout()}>
          <Ionicons name="log-out-outline" size={18} color={Colors.white} />
          <Text style={styles.logoutTxt}>Sair</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {wide ? sidebar : null}

      {!wide && drawerOpen ? (
        <Pressable style={styles.backdrop} onPress={() => setDrawerOpen(false)}>
          {sidebar}
        </Pressable>
      ) : null}

      <View style={styles.main}>
        <View style={styles.topbar}>
          {!wide ? (
            <Pressable
              style={styles.menuBtn}
              onPress={() => setDrawerOpen(true)}
              accessibilityLabel="Menu"
            >
              <Ionicons name="menu" size={24} color={Colors.white} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.topTitle}>{title}</Text>
          <Pressable
            style={styles.topIcon}
            onPress={() => router.push('/(tabs)/notificacoes')}
            accessibilityLabel="Notificações"
          >
            <Ionicons name="notifications-outline" size={22} color={Colors.white} />
            <UnreadBadge count={notifsUnread} dotOnly />
          </Pressable>
        </View>

        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.background,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  sidebar: {
    width: SIDEBAR_W,
    backgroundColor: Colors.surfaceDark,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    paddingTop: 20,
    paddingBottom: 16,
  },
  sidebarDrawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 15,
    flexDirection: 'row',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  brandLogo: { width: 36, height: 36 },
  brandName: { color: Colors.accent, fontSize: 18, fontWeight: '800' },
  brandSub: { color: Colors.textSecondary, fontSize: 12 },
  clubeChip: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(199,217,65,0.15)',
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  clubeChipEmpty: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
  },
  clubeChipEmptyTxt: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  navScroll: { paddingHorizontal: 10, paddingBottom: 20, gap: 4 },
  navSection: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: Colors.accent,
  },
  navLabel: { flex: 1, color: Colors.white, fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: Colors.textOnAccent },
  sidebarFoot: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  userName: { color: Colors.textSecondary, fontSize: 12 },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  logoutTxt: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  main: { flex: 1, minWidth: 0 },
  topbar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Colors.surface,
    gap: 12,
  },
  menuBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  topIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
});
