import { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

const SPLASH_MS = 1800;

export default function LaunchScreen() {
  const router = useRouter();
  const { user, loading, onboardingComplete } = useAuth();
  const navigated = useRef(false);

  useEffect(() => {
    if (loading || navigated.current) return;

    const timer = setTimeout(() => {
      navigated.current = true;
      if (!user) {
        router.replace('/onboarding');
        return;
      }
      if (onboardingComplete) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/primeiro-acesso');
      }
    }, SPLASH_MS);

    return () => clearTimeout(timer);
  }, [user, loading, onboardingComplete, router]);

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
