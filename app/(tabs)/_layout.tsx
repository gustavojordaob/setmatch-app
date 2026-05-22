import { Redirect, Tabs } from 'expo-router';
import { Colors } from '../../constants/colors';
import { BottomNav } from '../../components/ui/BottomNav';
import { useAuth } from '../../hooks/useAuth';

export default function TabsLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="trofeu" />
      <Tabs.Screen name="estatisticas" />
      <Tabs.Screen name="perfil" />
      <Tabs.Screen name="notificacoes" options={{ href: null }} />
      <Tabs.Screen name="desafios" options={{ href: null }} />
    </Tabs>
  );
}
