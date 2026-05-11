import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

export default function Index() {
  const router = useRouter();
  const { user, loading, onboardingComplete } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    if (!onboardingComplete) {
      router.replace('/onboarding');
      return;
    }
    router.replace('/(tabs)/home');
  }, [user, loading, onboardingComplete, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Setmatch</Text>
      <ActivityIndicator size="large" color={Colors.secondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F2D1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.secondary,
    marginBottom: 20,
    letterSpacing: 1,
  },
});
