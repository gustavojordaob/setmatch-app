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
      <Tabs.Screen name="desafios" />
      <Tabs.Screen name="trofeu" />
      <Tabs.Screen name="aulas" />
      <Tabs.Screen name="mensagens" />
      <Tabs.Screen name="perfil" />
      <Tabs.Screen name="estatisticas" options={{ href: null }} />
      <Tabs.Screen name="amigos" options={{ href: null }} />
      <Tabs.Screen name="notificacoes" options={{ href: null }} />
    </Tabs>
  );
}
