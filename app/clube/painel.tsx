import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../hooks/useAuth';
import { useSolicitacoesRecebidas } from '../../hooks/useRankings';
import { aceitarSolicitacao, recusarSolicitacao } from '../../services/rankings';
import { listarClubesDoDono, type ClubeCompleto } from '../../services/clubes';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../utils/firebaseConfig';

export default function ClubePainelScreen() {
  const router = useRouter();
  const { user, perfil, signOut } = useAuth();
  const recebidas = useSolicitacoesRecebidas();
  const [clubes, setClubes] = useState<ClubeCompleto[]>([]);
  const [torneiosCount, setTorneiosCount] = useState(0);
  const [rankingsCount, setRankingsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const list = await listarClubesDoDono(user.uid);
      setClubes(list);
      if (list[0]) {
        const tSnap = await getDocs(
          query(collection(db, 'torneios'), where('clubeId', '==', list[0].id))
        );
        const rSnap = await getDocs(
          query(collection(db, 'rankings'), where('clubeId', '==', list[0].id))
        );
        setTorneiosCount(tSnap.size);
        setRankingsCount(rSnap.size);
      } else {
        setTorneiosCount(0);
        setRankingsCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  const clube = clubes[0];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Painel do clube</Text>
        <TouchableOpacity
          onPress={() => {
            void signOut().then(() => router.replace('/onboarding'));
          }}
        >
          <Ionicons name="log-out-outline" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={carregar} tintColor={Colors.accent} />}
      >
        <Text style={styles.hello}>Olá, {perfil?.nome}</Text>
        {perfil?.setmatchId ? (
          <Text style={styles.idHint}>Seu ID: {perfil.setmatchId}</Text>
        ) : null}
        <Button
          label="Editar meu perfil"
          variant="outline"
          onPress={() => router.push('/perfil/editar')}
        />

        {!clube && !loading ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cadastre seu clube</Text>
            <Text style={styles.cardSub}>
              Nome, endereço completo, esportes e telefone — para jogadores encontrarem você.
            </Text>
            <Button label="Criar meu clube" onPress={() => router.push('/clube/novo')} />
          </View>
        ) : null}

        {loading && !clube ? <ActivityIndicator color={Colors.accent} /> : null}

        {clube ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{clube.nome}</Text>
              <Text style={styles.cardSub}>
                {[clube.endereco, clube.bairro, clube.cidade, clube.estado]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {clube.telefone ? (
                <Text style={styles.cardSub}>Tel: {clube.telefone}</Text>
              ) : null}
              <View style={styles.stats}>
                <Stat n={rankingsCount} label="Rankings" />
                <Stat n={torneiosCount} label="Torneios" />
                <Stat n={recebidas.length} label="Solicitações" />
              </View>
              <Button
                label="Editar clube"
                variant="outline"
                onPress={() => router.push({ pathname: '/clube/editar', params: { id: clube.id } })}
              />
            </View>

            <Text style={styles.section}>Gerenciar</Text>
            <Action
              icon="trophy-outline"
              label="Criar ranking"
              onPress={() =>
                router.push({
                  pathname: '/clube/ranking-novo',
                  params: { clubeId: clube.id },
                })
              }
            />
            <Action
              icon="calendar-outline"
              label="Criar torneio"
              onPress={() =>
                router.push({
                  pathname: '/clube/torneio-novo',
                  params: { clubeId: clube.id },
                })
              }
            />
            <Action
              icon="school-outline"
              label="Regras gerais de aulas"
              onPress={() => router.push('/clube/aulas-regras')}
            />
            <Action
              icon="fitness-outline"
              label="Modalidades (trio, beach…)"
              onPress={() => router.push('/clube/aulas-modalidades')}
            />
            <Action
              icon="people-outline"
              label="Alunos + desconto"
              onPress={() => router.push('/clube/alunos')}
            />
            <Action
              icon="cash-outline"
              label="Financeiro / pagamentos"
              onPress={() => router.push('/clube/financeiro')}
            />
            <Action
              icon="chatbubbles-outline"
              label="Mensagens do clube"
              onPress={() => router.push('/clube/mensagens')}
            />
            <Action
              icon="mail-outline"
              label="Avisar inscritos do torneio"
              onPress={() => router.push('/clube/torneio-mensagens')}
            />

            {recebidas.length > 0 ? (
              <>
                <Text style={styles.section}>Solicitações de ranking</Text>
                {recebidas.map((s) => (
                  <View key={s.id} style={styles.solRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.solNome}>{s.nome}</Text>
                      <Text style={styles.solMeta}>{s.rankingNome}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.ok}
                      onPress={() => void aceitarSolicitacao(s)}
                    >
                      <Ionicons name="checkmark" size={18} color={Colors.textOnAccent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.no}
                      onPress={() => void recusarSolicitacao(s.id)}
                    >
                      <Ionicons name="close" size={18} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <Ionicons name={icon} size={22} color={Colors.accent} />
      <Text style={styles.actionTxt}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: { color: Colors.accent, fontSize: 24, fontWeight: 'bold' },
  body: { padding: 20, gap: 12, paddingBottom: 40 },
  hello: { color: Colors.textPrimary, fontSize: 16, marginBottom: 4 },
  idHint: { color: Colors.accent, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  card: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold' },
  cardSub: { color: Colors.textSecondary, fontSize: 13 },
  stats: { flexDirection: 'row', gap: 12, marginVertical: 8 },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  statN: { color: Colors.accent, fontWeight: 'bold', fontSize: 20 },
  statL: { color: Colors.textSecondary, fontSize: 11 },
  section: { color: Colors.textPrimary, fontWeight: 'bold', fontSize: 16, marginTop: 12 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionTxt: { flex: 1, color: Colors.textPrimary, fontWeight: '600' },
  solRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  solNome: { color: Colors.textPrimary, fontWeight: 'bold' },
  solMeta: { color: Colors.textSecondary, fontSize: 12 },
  ok: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  no: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
