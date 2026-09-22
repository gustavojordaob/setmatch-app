import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { naoLidasDaConversa, useConversas, type Conversa } from '../../hooks/useConversas';
import { UnreadBadge } from '../../components/ui/UnreadBadge';
import { useT } from '../../hooks/useI18n';
import { TAB_BAR_CLEARANCE } from '../../constants/tabBar';

const TAB_PAD_BOTTOM = TAB_BAR_CLEARANCE;

type FiltroMsg = 'todas' | 'nao_lidas';

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
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroMsg>('todas');

  function tituloDa(c: Conversa): string {
    if (c.tipo === 'clube') return c.clubeNome ?? 'Clube';
    const outroUid = c.participantes.find((p) => p !== user?.uid);
    return (outroUid && c.nomes?.[outroUid]) || 'Jogador';
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return conversas.filter((c) => {
      const unread = naoLidasDaConversa(c, user?.uid);
      if (filtro === 'nao_lidas' && unread <= 0) return false;
      if (!q) return true;
      const titulo = tituloDa(c).toLowerCase();
      const preview = String(c.ultimoTexto ?? '').toLowerCase();
      return titulo.includes(q) || preview.includes(q);
    });
  }, [conversas, busca, filtro, user?.uid]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('mensagens.title')}</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/amigos')} hitSlop={8}>
          <Ionicons name="person-add-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Conversas com amigos e clubes.</Text>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={busca}
          onChangeText={setBusca}
          placeholder="Filtrar por nome…"
          placeholderTextColor={Colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
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

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: TAB_PAD_BOTTOM }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.textSecondary} />
              <Text style={styles.empty}>
                {busca || filtro === 'nao_lidas'
                  ? 'Nenhuma conversa neste filtro.'
                  : t('mensagens.noneRecent')}
              </Text>
              {!busca && filtro === 'todas' ? (
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => router.push('/(tabs)/amigos')}
                >
                  <Text style={styles.emptyBtnTxt}>{t('nav.friends')}</Text>
                </TouchableOpacity>
              ) : null}
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
