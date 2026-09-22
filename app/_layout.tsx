import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { WizardProvider } from '../contexts/WizardContext';
import { EsporteProvider } from '../contexts/EsporteContext';
import { ClubeProvider } from '../contexts/ClubeContext';
import { LocaleProvider } from '../contexts/LocaleContext';
import { AuthGuard } from '../components/AuthGuard';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useDeepLinkNavigation } from '../hooks/useDeepLinkNavigation';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { loading } = useAuth();
  // Web: garante fonte dos ícones (nativo já embute; não altera UX do app)
  const [fontsLoaded] = useFonts(Platform.OS === 'web' ? Ionicons.font : {});
  usePushNotifications();
  useDeepLinkNavigation();

  useEffect(() => {
    if (!loading && (Platform.OS !== 'web' || fontsLoaded)) {
      void SplashScreen.hideAsync();
    }
  }, [loading, fontsLoaded]);

  if (Platform.OS === 'web' && !fontsLoaded) {
    return null;
  }

  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <WizardProvider>
          <EsporteProvider>
            <ClubeProvider>
              <RootStack />
            </ClubeProvider>
          </EsporteProvider>
        </WizardProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
