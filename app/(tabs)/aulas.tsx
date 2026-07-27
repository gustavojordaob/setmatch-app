import { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { EsporteSwitcher } from '../../components/EsporteSwitcher';
import { useMeusClubes } from '../../hooks/useMeusClubes';
import { useEsporte } from '../../contexts/EsporteContext';
import { useClube } from '../../contexts/ClubeContext';

const TAB_PAD_BOTTOM = 88;

const STATUS_LABEL: Record<string, string> = {
  ativa: 'Matrícula ativa',
  pendente: 'Matrícula pendente',
  aguardando_pagamento: 'Aguardando pagamento',
  cancelada: 'Cancelada',
};

export default function AulasScreen() {
  const router = useRouter();
  const { esporteAtivo } = useEsporte();
  const { clubes, matriculas, loading } = useMeusClubes();
  const { clubesDisponiveis } = useClube();

  // Clubes onde já sou aluno (tenho matrícula)
  const meusComAula = useMemo(() => {
    const idsMatricula = new Set(matriculas.map((m) => m.clubeId));
    return clubes.filter((c) => idsMatricula.has(c.id));
  }, [clubes, matriculas]);

  // Outros clubes do esporte ativo para descobrir aulas
  const paraDescobrir = useMemo(() => {
    const ja = new Set(meusComAula.map((c) => c.id));
    return clubesDisponiveis.filter((c) => !ja.has(c.id)).slice(0, 12);
  }, [clubesDisponiveis, meusComAula]);

  function statusDo(clubeId: string): string {
    const m = matriculas.find((x) => x.clubeId === clubeId);
    return m ? (STATUS_LABEL[m.status] ?? m.status) : '';
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Aulas</Text>
        <TouchableOpacity onPress={() => router.push('/pagamentos')} hitSlop={8}>
          <Ionicons name="card-outline" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>Suas aulas e modalidades por clube.</Text>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: TAB_PAD_BOTTOM }}>
        <EsporteSwitcher variant="chips" />

        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 30 }} />
        ) : (
          <>
            <Text style={styles.section}>Minhas aulas</Text>
            {meusComAula.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="school-outline" size={32} color={Colors.textSecondary} />
                <Text style={styles.empty}>
                  Você ainda não é aluno de nenhum clube. Veja as modalidades abaixo e fale com
                  o clube para começar.
                </Text>
              </View>
            ) : (
              meusComAula.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.cardAluno}
                  onPress={() => router.push(`/meu-clube/${c.id}/aulas`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clubeNome}>{c.nome}</Text>
                    <Text style={styles.clubeMeta}>{c.cidade}</Text>
                    <Text style={styles.status}>{statusDo(c.id)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.accent} />
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.section}>Descobrir aulas</Text>
            {paraDescobrir.length === 0 ? (
              <Text style={styles.emptySmall}>
                Nenhum outro clube deste esporte por enquanto.
              </Text>
            ) : (
              paraDescobrir.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.cardDescobrir}
                  onPress={() => router.push(`/meu-clube/${c.id}/aulas`)}
                >
                  <View style={styles.iconBox}>
                    <Ionicons name="tennisball-outline" size={20} color={Colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clubeNome}>{c.nome}</Text>
                    <Text style={styles.clubeMeta}>{c.cidade || 'Ver modalidades e valores'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push('/pagamentos')}
            >
              <Ionicons name="card-outline" size={18} color={Colors.accent} />
              <Text style={styles.linkTxt}>Ver pagamentos de aulas</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
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
  section: {
    color: Colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 22,
    marginBottom: 10,
  },
  cardAluno: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  cardDescobrir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubeNome: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 15 },
  clubeMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  status: { color: Colors.accent, fontWeight: '700', fontSize: 12, marginTop: 6 },
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  empty: { color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  emptySmall: { color: Colors.textSecondary, fontSize: 13 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  linkTxt: { color: Colors.accent, fontWeight: '700' },
});
