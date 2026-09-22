import { useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { useAuth } from '../../hooks/useAuth';
import { naoLidasDaConversa, useConversas } from '../../hooks/useConversas';
import { UnreadBadge } from '../../components/ui/UnreadBadge';

type FiltroMsg = 'todas' | 'nao_lidas';

export default function ClubeMensagensScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const conversas = useConversas().filter((c) => c.tipo === 'clube');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroMsg>('todas');

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      const unread = naoLidasDaConversa(c, user?.uid);
      if (filtro === 'nao_lidas' && unread <= 0) return false;
      const outro = c.participantes.find((p) => p !== user?.uid);
      const nome = ((outro && c.nomes?.[outro]) || 'Jogador').toLowerCase();
      const preview = String(c.ultimoTexto ?? '').toLowerCase();
      if (!q) return true;
      return nome.includes(q) || preview.includes(q);
    });
  }, [conversas, busca, filtro, user?.uid]);

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

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Filtrar por jogador…"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {busca ? (
          <TouchableOpacity onPress={() => setBusca('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.chips}>
        {(
          [
            { id: 'todas' as const, label: 'Todas' },
            { id: 'nao_lidas' as const, label: 'Não lidas' },
          ] as const
        ).map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, filtro === c.id && styles.chipOn]}
            onPress={() => setFiltro(c.id)}
          >
            <Text style={[styles.chipTxt, filtro === c.id && styles.chipTxtOn]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {busca || filtro === 'nao_lidas'
              ? 'Nenhuma conversa neste filtro.'
              : 'Quando jogadores enviarem mensagem ao clube, elas aparecem aqui.'}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 10,
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipTxt: { color: Colors.textSecondary, fontWeight: '700', fontSize: 13 },
  chipTxtOn: { color: Colors.textOnAccent },
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
