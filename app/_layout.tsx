import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { WizardProvider } from '../contexts/WizardContext';
import { EsporteProvider } from '../contexts/EsporteContext';
import { ClubeProvider } from '../contexts/ClubeContext';
import { LocaleProvider } from '../contexts/LocaleContext';
import { AuthGuard } from '../components/AuthGuard';
import { usePushNotifications } from '../hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { loading } = useAuth();
  usePushNotifications();

  useEffect(() => {
    if (!loading) {
      void SplashScreen.hideAsync();
    }
  }, [loading]);

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
