import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

/** Usuário comum não cria ranking — redireciona admin ou volta. */
export default function RankingNovoRedirect() {
  const router = useRouter();
  const { isAdminClube, perfil } = useAuth();

  useEffect(() => {
    if (isAdminClube) {
      if (perfil?.clubeId) {
        router.replace({
          pathname: '/clube/ranking-novo',
          params: { clubeId: perfil.clubeId },
        });
      } else {
        router.replace('/clube/painel');
      }
    } else {
      router.replace('/(tabs)/trofeu');
    }
  }, [isAdminClube, perfil?.clubeId, router]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.box}>
        <ActivityIndicator color={Colors.accent} />
        <Text style={styles.txt}>
          Rankings são criados pelo admin do clube.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  txt: { color: Colors.textSecondary, textAlign: 'center' },
});
