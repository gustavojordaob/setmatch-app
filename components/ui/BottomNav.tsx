import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

const TAB_CONFIG: {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'trofeu', label: 'Troféu', icon: 'trophy' },
  { name: 'estatisticas', label: 'Estatísticas', icon: 'stats-chart' },
  { name: 'perfil', label: 'Perfil', icon: 'person' },
];

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes
          .filter((r) => TAB_CONFIG.some((t) => t.name === r.name))
          .map((route) => {
            const cfg = TAB_CONFIG.find((t) => t.name === route.name)!;
            const index = state.routes.findIndex((r) => r.key === route.key);
            const focused = state.index === index;
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
                  <Ionicons name={cfg.icon} size={20} color={Colors.textOnAccent} />
                  <Text style={styles.activeLabel}>{cfg.label}</Text>
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity key={route.key} onPress={onPress} style={styles.inactive}>
                <Ionicons name={`${cfg.icon}-outline` as keyof typeof Ionicons.glyphMap} size={26} color={Colors.white} />
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
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.surfaceDark,
    borderRadius: 40,
    height: 64,
    paddingHorizontal: 12,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  activeLabel: {
    color: Colors.textOnAccent,
    fontWeight: 'bold',
    fontSize: 13,
  },
  inactive: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
