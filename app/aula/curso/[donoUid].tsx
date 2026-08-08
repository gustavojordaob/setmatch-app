import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { ESPORTES, type EsporteId } from '../../../constants/esportes';
import { Avatar } from '../../../components/ui/Avatar';
import { useAuth } from '../../../hooks/useAuth';
import {
  listarAulasDoProfessor,
  temAcessoAulaOnline,
  type AulaPublicada,
} from '../../../services/aulasPublicadas';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../utils/firebaseConfig';

export default function CursoProfessorScreen() {
  const { donoUid, esporte: esporteParam } = useLocalSearchParams<{
    donoUid: string;
    esporte?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const esporte = (esporteParam as EsporteId) || 'tenis';
  const [aulas, setAulas] = useState<AulaPublicada[]>([]);
  const [acesso, setAcesso] = useState<Record<string, boolean>>({});
  const [fotoUrl, setFotoUrl] = useState<string | undefined>();
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!donoUid) return;
    setLoading(true);
    try {
      const list = await listarAulasDoProfessor(donoUid, {
        modo: 'online',
        esporte,
      });
      setAulas(list);
      setNome(list[0]?.origemNome ?? 'Instrutor');
      const map: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (a) => {
          map[a.id] = await temAcessoAulaOnline(user?.uid, a);
        })
      );
      setAcesso(map);
      const uSnap = await getDoc(doc(db, 'usuarios', donoUid));
      if (uSnap.exists()) {
        const raw = uSnap.data();
        if (raw.fotoUrl) setFotoUrl(String(raw.fotoUrl));
        if (raw.nome) setNome(String(raw.nome));
      }
    } finally {
      setLoading(false);
    }
  }, [donoUid, esporte, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const porModulo = useMemo(() => {
    const map = new Map<string, AulaPublicada[]>();
    for (const a of aulas) {
      const key = a.modulo?.trim() || 'Módulo';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).map(([modulo, items]) => ({
      modulo,
      items: items.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)),
    }));
  }, [aulas]);

  const esporteNome = ESPORTES.find((e) => e.id === esporte)?.nome ?? esporte;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Curso online</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <TouchableOpacity
            style={styles.profRow}
            onPress={() => donoUid && router.push(`/jogador/${donoUid}`)}
            activeOpacity={0.85}
          >
            <Avatar uri={fotoUrl} nome={nome} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={styles.nome}>{nome}</Text>
              <Text style={styles.meta}>
                {esporteNome} · {aulas.length} aula{aulas.length === 1 ? '' : 's'} ·{' '}
                {porModulo.length} módulo{porModulo.length === 1 ? '' : 's'}
              </Text>
              <Text style={styles.verPerfil}>Ver perfil e estatísticas</Text>
            </View>
          </TouchableOpacity>

          {porModulo.length === 0 ? (
            <Text style={styles.empty}>Nenhuma aula neste esporte.</Text>
          ) : (
            porModulo.map((bloco) => (
              <View key={bloco.modulo} style={styles.bloco}>
                <Text style={styles.moduloTitulo}>{bloco.modulo}</Text>
                {bloco.items.map((a) => {
                  const liberada = acesso[a.id] !== false;
                  const bloqueada = Boolean(a.pago) && !liberada;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      style={styles.aulaRow}
                      onPress={() =>
                        router.push({ pathname: '/aula/[id]', params: { id: a.id } })
                      }
                    >
                      <View style={[styles.thumb, bloqueada && styles.thumbLocked]}>
                        <Ionicons
                          name={bloqueada ? 'lock-closed' : 'play'}
                          size={20}
                          color={bloqueada ? Colors.textPrimary : Colors.textOnAccent}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.aulaTitulo}>{a.titulo}</Text>
                        <View style={styles.badgeRow}>
                          <View
                            style={[styles.badge, a.pago ? styles.badgePago : styles.badgeGratis]}
                          >
                            <Text
                              style={[
                                styles.badgeTxt,
                                a.pago ? styles.badgeTxtPago : styles.badgeTxtGratis,
                              ]}
                            >
                              {a.pago
                                ? `Paga${a.valorOnline ? ` · R$ ${a.valorOnline.toFixed(2)}` : ''}`
                                : 'Grátis'}
                            </Text>
                          </View>
                          {bloqueada ? (
                            <Text style={styles.lockHint}>Bloqueada</Text>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.accent} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
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
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerTitle: { color: Colors.accent, fontSize: 18, fontWeight: '900' },
  body: { padding: 16, paddingBottom: 40 },
  profRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  nome: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  meta: { color: Colors.textSecondary, marginTop: 4, fontWeight: '600' },
  verPerfil: { color: Colors.accent, marginTop: 6, fontWeight: '700', fontSize: 13 },
  bloco: { marginBottom: 20 },
  moduloTitulo: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 16,
    marginBottom: 10,
  },
  aulaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  thumbLocked: { backgroundColor: Colors.surfaceDark, paddingLeft: 0 },
  aulaTitulo: { color: Colors.textPrimary, fontWeight: '700', fontSize: 15 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: { borderRadius: 60, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGratis: { backgroundColor: 'rgba(199,217,65,0.2)' },
  badgePago: { backgroundColor: 'rgba(255,255,255,0.12)' },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  badgeTxtGratis: { color: Colors.accent },
  badgeTxtPago: { color: Colors.textPrimary },
  lockHint: { color: Colors.textSecondary, fontSize: 11, fontWeight: '600' },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },
});
