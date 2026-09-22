import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { ConfrontoTorneio } from '../../services/chaveamentoTorneio';
import {
  montarTabelasGrupos,
  type LinhaClassificacao,
} from '../../services/gruposTorneio';

type Props = {
  confrontos: ConfrontoTorneio[];
  onPressJogo: (c: ConfrontoTorneio) => void;
  classificadosPorGrupo?: number;
};

export function GruposTorneioPainel({
  confrontos,
  onPressJogo,
  classificadosPorGrupo = 2,
}: Props) {
  const grupos = montarTabelasGrupos(confrontos);
  if (grupos.length === 0) return null;

  const todosCompletos = grupos.every((g) => g.completo);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Fase de grupos</Text>
      <Text style={styles.hint}>
        Classificam os {classificadosPorGrupo} primeiros de cada grupo
        {todosCompletos
          ? ' · todos os jogos encerrados — mata-mata em seguida'
          : ' · ao terminar todos os jogos, a chave é gerada automaticamente'}
      </Text>

      {grupos.map((g) => (
        <View key={g.grupoId} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.grupoNome}>{g.grupoNome}</Text>
            <Text style={styles.badge}>{g.completo ? 'Completo' : 'Em andamento'}</Text>
          </View>

          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colPos]}>#</Text>
            <Text style={[styles.th, styles.colNome]}>Jogador</Text>
            <Text style={styles.th}>J</Text>
            <Text style={styles.th}>V</Text>
            <Text style={styles.th}>Pts</Text>
          </View>
          {g.tabela.map((linha, i) => (
            <Linha
              key={linha.uid}
              linha={linha}
              pos={i + 1}
              classifica={i < classificadosPorGrupo}
            />
          ))}

          <Text style={styles.jogosLabel}>Jogos</Text>
          {g.jogos.map((jogo) => (
            <TouchableOpacity
              key={jogo.id}
              style={styles.jogoRow}
              onPress={() => onPressJogo(jogo)}
            >
              <Text style={styles.jogoTxt} numberOfLines={1}>
                {jogo.j1Nome || '—'} vs {jogo.j2Nome || '—'}
              </Text>
              <Text style={styles.jogoStatus}>
                {jogo.resultadoTipo === 'wo'
                  ? 'W.O.'
                  : jogo.status === 'finalizado'
                    ? jogo.sets.map((s) => `${s.j1}-${s.j2}`).join(' ')
                    : jogo.status === 'pronto'
                      ? 'Jogar'
                      : '—'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

function Linha({
  linha,
  pos,
  classifica,
}: {
  linha: LinhaClassificacao;
  pos: number;
  classifica: boolean;
}) {
  return (
    <View style={[styles.tr, classifica && styles.trOk]}>
      <Text style={[styles.td, styles.colPos]}>{pos}</Text>
      <Text style={[styles.td, styles.colNome]} numberOfLines={1}>
        {linha.nome}
      </Text>
      <Text style={styles.td}>{linha.jogados}</Text>
      <Text style={styles.td}>{linha.vitorias}</Text>
      <Text style={[styles.td, styles.pts]}>{linha.pontos}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginBottom: 8 },
  title: { color: Colors.accent, fontSize: 18, fontWeight: '800' },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18 },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grupoNome: { color: Colors.white, fontWeight: '800', fontSize: 16 },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '700' },
  tableHead: { flexDirection: 'row', gap: 6, marginTop: 4 },
  th: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700', width: 28, textAlign: 'center' },
  tr: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingVertical: 4 },
  trOk: { backgroundColor: 'rgba(199,217,65,0.12)', borderRadius: 8, paddingHorizontal: 4 },
  td: { color: Colors.white, fontSize: 12, width: 28, textAlign: 'center' },
  colPos: { width: 22 },
  colNome: { flex: 1, textAlign: 'left', width: undefined as unknown as number },
  pts: { fontWeight: '800', color: Colors.accent },
  jogosLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginTop: 6 },
  jogoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  jogoTxt: { flex: 1, color: Colors.white, fontSize: 13 },
  jogoStatus: { color: Colors.accent, fontWeight: '700', fontSize: 12 },
});
