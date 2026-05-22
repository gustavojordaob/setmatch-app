import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { useAuth } from '../hooks/useAuth';

const SPLASH_MS = 1800;

export default function LaunchScreen() {
  const router = useRouter();
  const { user, loading, onboardingComplete } = useAuth();
  const opacity = useRef(new Animated.Value(0)).current;
  const navigated = useRef(false);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  useEffect(() => {
    if (loading || navigated.current) return;

    const timer = setTimeout(() => {
      navigated.current = true;
      if (!user) {
        router.replace('/onboarding/1');
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
      <Animated.View style={{ opacity }}>
        <Text style={styles.logo}>SETMATCH</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    ...Typography.userName,
    color: Colors.accent,
    letterSpacing: 4,
  },
});
