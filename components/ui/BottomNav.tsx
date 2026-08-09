import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { TAB_BAR_HEIGHT } from '../../constants/tabBar';
import { useT } from '../../hooks/useI18n';
import { useTotalNaoLidas } from '../../hooks/useTotalNaoLidas';

const TAB_CONFIG: {
  name: string;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'home', labelKey: 'nav.home', icon: 'home' },
  { name: 'desafios', labelKey: 'nav.matches', icon: 'tennisball' },
  { name: 'trofeu', labelKey: 'nav.rankings', icon: 'trophy' },
  { name: 'aulas', labelKey: 'nav.classes', icon: 'school' },
  { name: 'mensagens', labelKey: 'nav.chat', icon: 'chatbubbles' },
  { name: 'perfil', labelKey: 'nav.profile', icon: 'person' },
];

/** Padding inferior recomendado para ScrollViews das tabs. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, 8) + 24;
}

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const msgsNaoLidas = useTotalNaoLidas();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      <View style={styles.bar}>
        {state.routes
          .filter((r) => TAB_CONFIG.some((tab) => tab.name === r.name))
          .map((route) => {
            const cfg = TAB_CONFIG.find((tab) => tab.name === route.name)!;
            const index = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === index;
            const showMsgBadge = route.name === 'mensagens' && msgsNaoLidas > 0;
            const onPress = () => {
              const ev = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !ev.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            if (focused) {
              return (
                <TouchableOpacity key={route.key} onPress={onPress} style={styles.activePill}>
                  <View>
                    <Ionicons name={cfg.icon} size={20} color={Colors.textOnAccent} />
                    {showMsgBadge ? <View style={styles.pillDot} /> : null}
                  </View>
                  <Text style={styles.activeLabel}>{t(cfg.labelKey)}</Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity key={route.key} onPress={onPress} style={styles.inactive}>
                <Ionicons
                  name={`${cfg.icon}-outline` as keyof typeof Ionicons.glyphMap}
                  size={26}
                  color={Colors.white}
                />
                {showMsgBadge ? (
                  <View style={styles.navBadge}>
                    <Text style={styles.navBadgeTxt}>
                      {msgsNaoLidas > 99 ? '99+' : msgsNaoLidas}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    zIndex: 100,
    elevation: 24,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 40,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 8,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  activeLabel: {
    color: Colors.textOnAccent,
    fontWeight: 'bold',
    fontSize: 12,
  },
  inactive: {
    padding: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeTxt: { color: Colors.white, fontSize: 9, fontWeight: 'bold' },
  pillDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
});
