import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

const SPLASH_MS = 1200;

export default function LaunchScreen() {
  const router = useRouter();
  const { user, loading, onboardingComplete, isAdminClube } = useAuth();
  const navigated = useRef(false);

  useEffect(() => {
    if (loading || navigated.current) return;

    const timer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;

      if (!user) {
        router.replace('/onboarding');
        return;
      }

      if (isAdminClube) {
        router.replace(onboardingComplete ? '/clube/painel' : '/clube/onboarding');
        return;
      }

      router.replace(onboardingComplete ? '/(tabs)/home' : '/primeiro-acesso');
    }, SPLASH_MS);

    return () => clearTimeout(timer);
  }, [user, loading, onboardingComplete, isAdminClube, router]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/Launch.png')}
        style={styles.image}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
});
