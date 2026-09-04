import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { naoLidasDaConversa, useConversas, type Conversa } from '../../hooks/useConversas';
import { UnreadBadge } from '../../components/ui/UnreadBadge';
import { useT } from '../../hooks/useI18n';

import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';
const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

function formatHora(seconds?: number): string {
  if (!seconds) return '';
  const d = new Date(seconds * 1000);
  const hoje = new Date();
  const mesmoDia =
    d.getDate() === hoje.getDate() &&
    d.getMonth() === hoje.getMonth() &&
    d.getFullYear() === hoje.getFullYear();
  if (mesmoDia) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function MensagensScreen() {
  const router = useRouter();
  const t = useT();
  const { user, loading } = useAuth();
  const conversas = useConversas();

  function tituloDa(c: Conversa): string {
    if (c.tipo === 'clube') return c.clubeNome ?? 'Clube';
    const outroUid = c.participantes.find((p) => p !== user?.uid);
    return (outroUid && c.nomes?.[outroUid]) || 'Jogador';
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('mensagens.title')}</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/amigos')} hitSlop={8}>
          <Ionicons name="person-add-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Conversas com amigos e clubes.</Text>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={conversas}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: TAB_PAD_BOTTOM }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.empty}>{t('mensagens.noneRecent')}</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/(tabs)/amigos')}
              >
                <Text style={styles.emptyBtnTxt}>{t('nav.friends')}</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const titulo = tituloDa(item);
            const outroUid = item.participantes.find((p) => p !== user?.uid);
            const fotoUri = outroUid ? item.fotos?.[outroUid] : undefined;
            const unread = naoLidasDaConversa(item, user?.uid);
            return (
              <TouchableOpacity
                style={[styles.row, unread > 0 && styles.rowUnread]}
                onPress={() => router.push(`/chat/${item.id}`)}
              >
                <Avatar uri={fotoUri} nome={titulo} size="md" />
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text
                      style={[styles.nome, unread > 0 && styles.nomeUnread]}
                      numberOfLines={1}
                    >
                      {titulo}
                    </Text>
                    <Text style={styles.hora}>{formatHora(item.atualizadoEm?.seconds)}</Text>
                  </View>
                  <Text
                    style={[styles.preview, unread > 0 && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {item.tipo === 'clube' ? '🏟️ ' : ''}
                    {item.ultimoTexto || 'Comece a conversa…'}
                  </Text>
                </View>
                {unread > 0 ? (
                  <UnreadBadge count={unread} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  title: { color: Colors.textPrimary, fontSize: 26, fontWeight: 'bold' },
  sub: { color: Colors.textSecondary, paddingHorizontal: 20, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  rowUnread: { borderWidth: 1, borderColor: Colors.accent },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nome: { flex: 1, color: Colors.textPrimary, fontWeight: 'bold', fontSize: 15 },
  nomeUnread: { color: Colors.accent },
  hora: { color: Colors.textSecondary, fontSize: 11, marginLeft: 8 },
  preview: { color: Colors.textSecondary, fontSize: 13, marginTop: 3 },
  previewUnread: { color: Colors.textPrimary, fontWeight: '600' },
  emptyBox: { alignItems: 'center', gap: 14, marginTop: 60, paddingHorizontal: 24 },
  empty: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 60,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnTxt: { color: Colors.textOnAccent, fontWeight: 'bold' },
});
