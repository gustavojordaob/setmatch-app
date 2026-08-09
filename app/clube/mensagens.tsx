import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { naoLidasDaConversa, useConversas } from '../../hooks/useConversas';
import { UnreadBadge } from '../../components/ui/UnreadBadge';

export default function ClubeMensagensScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const conversas = useConversas().filter((c) => c.tipo === 'clube');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.title}>Mensagens do clube</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/notificacoes')}>
          <Ionicons name="notifications-outline" size={24} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={conversas}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Quando jogadores enviarem mensagem ao clube, elas aparecem aqui.
          </Text>
        }
        renderItem={({ item }) => {
          const outro = item.participantes.find((p) => p !== user?.uid);
          const nome = (outro && item.nomes?.[outro]) || 'Jogador';
          const unread = naoLidasDaConversa(item, user?.uid);
          return (
            <TouchableOpacity
              style={[styles.row, unread > 0 && styles.rowUnread]}
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.nome, unread > 0 && styles.nomeUnread]}>{nome}</Text>
                <Text
                  style={[styles.meta, unread > 0 && styles.metaUnread]}
                  numberOfLines={1}
                >
                  {item.ultimoTexto || 'Nova conversa'}
                </Text>
              </View>
              <UnreadBadge count={unread} />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 18 },
  list: { padding: 20 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rowUnread: { backgroundColor: 'rgba(199,217,65,0.08)', borderRadius: 12, paddingHorizontal: 8 },
  nome: { color: Colors.textPrimary, fontWeight: 'bold' },
  nomeUnread: { color: Colors.accent },
  meta: { color: Colors.textSecondary, fontSize: 12 },
  metaUnread: { color: Colors.textPrimary, fontWeight: '600' },
});
