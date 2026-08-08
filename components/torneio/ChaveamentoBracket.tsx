import { useMemo } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Avatar } from '../ui/Avatar';
import type { ConfrontoTorneio } from '../../services/chaveamentoTorneio';

const CARD_W = 168;
const CARD_H = 96;
const GAP = 14;
const COL_GAP = 8;
const ARROW_W = 28;
const HEADER_H = 36;

type Props = {
  confrontos: ConfrontoTorneio[];
  onPressMatch: (c: ConfrontoTorneio) => void;
  /** Destaque opcional do caminho do usuário logado */
  highlightUid?: string;
};

function placarLabel(c: ConfrontoTorneio): string {
  if (c.sets.length > 0) {
    return c.sets.map((s) => `${s.j1}-${s.j2}`).join(' ');
  }
  if (c.status === 'bye') return 'BYE';
  if (c.status === 'pronto') return 'Jogar';
  return '—';
}

/**
 * Chave horizontal estilo apps de esporte (FotMob / NBA / UEFA):
 * Oitavas → Quartas → Semi → Final, deslizando para o lado.
 * Cada fase seguinte fica visualmente entre os dois confrontos que a alimentam.
 */
export function ChaveamentoBracket({
  confrontos,
  onPressMatch,
  highlightUid,
}: Props) {
  const rodadas = useMemo(() => {
    const map = new Map<number, ConfrontoTorneio[]>();
    for (const c of confrontos) {
      if (!map.has(c.round)) map.set(c.round, []);
      map.get(c.round)!.push(c);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, lista]) => ({
        round,
        label: lista[0]?.labelRodada || `R${round}`,
        matches: [...lista].sort((a, b) => a.pos - b.pos),
      }));
  }, [confrontos]);

  const slotBase = CARD_H + GAP;
  const maxMatches = rodadas[0]?.matches.length ?? 1;
  const treeHeight = Math.max(maxMatches * slotBase - GAP, CARD_H);

  if (rodadas.length === 0) return null;

  const screenW = Dimensions.get('window').width;

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Chaveamento</Text>
        <View style={styles.swipeHint}>
          <Text style={styles.swipeTxt}>Deslize</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.accent} />
        </View>
      </View>
      <Text style={styles.hint}>
        Oitavas → Quartas → Semi → Final. Toque no confronto para o placar.
      </Text>

      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        decelerationRate="fast"
        contentContainerStyle={styles.hContent}
        style={styles.hScroll}
      >
        {rodadas.map((rodada, ri) => {
          const factor = Math.pow(2, ri);
          const slot = slotBase * factor;
          const padTop = (slot - CARD_H) / 2;

          return (
            <View key={rodada.round} style={styles.colGroup}>
              <View style={[styles.column, { height: HEADER_H + treeHeight }]}>
                <View style={styles.roundHeader}>
                  <Text style={styles.roundLabel} numberOfLines={1}>
                    {rodada.label}
                  </Text>
                </View>
                <View style={{ height: treeHeight, width: CARD_W }}>
                  {rodada.matches.map((c, mi) => {
                    const top = padTop + mi * slot;
                    const noCaminho =
                      !!highlightUid &&
                      (c.j1Uid === highlightUid || c.j2Uid === highlightUid);
                    const podeTocar = c.status === 'pronto';
                    return (
                      <TouchableOpacity
                        key={c.id}
                        activeOpacity={podeTocar ? 0.85 : 1}
                        disabled={!podeTocar}
                        onPress={() => onPressMatch(c)}
                        style={[
                          styles.card,
                          { top },
                          c.status === 'pronto' && styles.cardPronto,
                          c.status === 'finalizado' && styles.cardDone,
                          noCaminho && styles.cardHighlight,
                        ]}
                      >
                        <PlayerLine
                          nome={c.j1Nome || 'A definir'}
                          foto={c.j1Foto}
                          win={c.vencedorUid === c.j1Uid && !!c.vencedorUid}
                          lose={
                            !!c.vencedorUid &&
                            c.vencedorUid !== c.j1Uid &&
                            c.status === 'finalizado'
                          }
                          me={highlightUid === c.j1Uid}
                        />
                        <View style={styles.divider} />
                        <PlayerLine
                          nome={
                            c.j2Nome ||
                            (c.status === 'bye' ? '—' : 'A definir')
                          }
                          foto={c.j2Foto}
                          win={c.vencedorUid === c.j2Uid && !!c.vencedorUid}
                          lose={
                            !!c.vencedorUid &&
                            c.vencedorUid !== c.j2Uid &&
                            c.status === 'finalizado'
                          }
                          me={highlightUid === c.j2Uid}
                        />
                        <Text style={styles.placar}>{placarLabel(c)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {ri < rodadas.length - 1 ? (
                <View style={[styles.arrowCol, { height: HEADER_H + treeHeight }]}>
                  <View style={{ height: HEADER_H }} />
                  <View style={styles.arrowBody}>
                    <View style={styles.connector} />
                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color={Colors.accent}
                    />
                    <View style={styles.connector} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
        {/* padding final para não colar na borda */}
        <View style={{ width: Math.max(16, screenW * 0.08) }} />
      </ScrollView>
    </View>
  );
}

function PlayerLine({
  nome,
  foto,
  win,
  lose,
  me,
}: {
  nome: string;
  foto: string;
  win: boolean;
  lose: boolean;
  me: boolean;
}) {
  return (
    <View style={styles.playerRow}>
      <Avatar uri={foto || undefined} nome={nome} size="sm" />
      <Text
        style={[
          styles.playerName,
          win && styles.win,
          lose && styles.lose,
          me && styles.me,
        ]}
        numberOfLines={1}
      >
        {nome}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: Colors.textPrimary, fontWeight: '900', fontSize: 18 },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 60,
  },
  swipeTxt: { color: Colors.accent, fontWeight: '700', fontSize: 12 },
  hint: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  hScroll: { marginHorizontal: -4 },
  hContent: {
    paddingVertical: 8,
    paddingLeft: 4,
    alignItems: 'flex-start',
  },
  colGroup: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { width: CARD_W },
  roundHeader: {
    height: HEADER_H,
    justifyContent: 'center',
    marginBottom: 0,
  },
  roundLabel: {
    color: Colors.accent,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  card: {
    position: 'absolute',
    left: 0,
    width: CARD_W,
    height: CARD_H,
    backgroundColor: Colors.surfaceDark,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'space-between',
  },
  cardPronto: {
    borderColor: Colors.accent,
    borderWidth: 1.5,
  },
  cardDone: { opacity: 0.95 },
  cardHighlight: {
    shadowColor: Colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 12,
    flex: 1,
  },
  win: { color: Colors.accent, fontWeight: '900' },
  lose: { color: Colors.textSecondary, opacity: 0.7 },
  me: { textDecorationLine: 'underline' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical: 2,
  },
  placar: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'right',
  },
  arrowCol: {
    width: ARROW_W + COL_GAP * 2,
    alignItems: 'center',
  },
  arrowBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  connector: {
    width: 2,
    flex: 1,
    maxHeight: 40,
    backgroundColor: 'rgba(199,217,65,0.35)',
    borderRadius: 1,
  },
});
