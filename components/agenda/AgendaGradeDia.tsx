import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import {
  categoriaTipoReserva,
  labelTipoReserva,
  type GradeSlot,
  type SlotLivre,
} from '../../types/agenda';

type Props = {
  grade: GradeSlot[];
  /** Só slots livres tocáveis (ex.: marcar ranking) */
  selecionavel?: boolean;
  slotSel?: SlotLivre | null;
  onSelectLivre?: (s: SlotLivre) => void;
  emptyText?: string;
};

function fmtHora(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function badgeColors(cat: ReturnType<typeof categoriaTipoReserva>) {
  switch (cat) {
    case 'ranking':
      return { bg: 'rgba(199,217,65,0.2)', fg: Colors.accent };
    case 'torneio':
      return { bg: 'rgba(99,140,255,0.25)', fg: '#9BB4FF' };
    case 'amistoso':
      return { bg: 'rgba(255,180,80,0.22)', fg: '#FFC070' };
    case 'aula':
      return { bg: 'rgba(180,120,255,0.22)', fg: '#C9A0FF' };
    default:
      return { bg: Colors.surface, fg: Colors.textSecondary };
  }
}

export function AgendaGradeDia({
  grade,
  selecionavel,
  slotSel,
  onSelectLivre,
  emptyText = 'Nenhum horário neste dia (fora do funcionamento ou sem quadras).',
}: Props) {
  if (grade.length === 0) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {grade.map((s) => {
        const key = `${s.quadraId}-${s.inicio.getTime()}-${s.kind}`;
        const hora = `${fmtHora(s.inicio)} – ${fmtHora(s.fim)}`;

        if (s.kind === 'livre') {
          const on =
            slotSel?.quadraId === s.quadraId &&
            slotSel.inicio.getTime() === s.inicio.getTime();
          const body = (
            <>
              <View style={styles.rowTop}>
                <Text style={[styles.hora, on && styles.onTxt]}>{hora}</Text>
                <View style={[styles.badge, styles.badgeLivre]}>
                  <Text style={styles.badgeLivreTxt}>Livre</Text>
                </View>
              </View>
              <Text style={[styles.quadra, on && styles.onTxt]}>
                {s.quadraNome} · {s.duracaoMin} min
              </Text>
            </>
          );
          if (selecionavel && onSelectLivre) {
            return (
              <TouchableOpacity
                key={key}
                style={[styles.card, styles.cardLivre, on && styles.cardOn]}
                onPress={() =>
                  onSelectLivre({
                    inicio: s.inicio,
                    fim: s.fim,
                    quadraId: s.quadraId,
                    quadraNome: s.quadraNome,
                    duracaoMin: s.duracaoMin,
                  })
                }
              >
                {body}
              </TouchableOpacity>
            );
          }
          return (
            <View key={key} style={[styles.card, styles.cardLivre]}>
              {body}
            </View>
          );
        }

        const cat = categoriaTipoReserva(s.reserva.tipo);
        const bc = badgeColors(cat);
        const nomes =
          s.reserva.jogador1Nome && s.reserva.jogador2Nome
            ? `${s.reserva.jogador1Nome} × ${s.reserva.jogador2Nome}`
            : s.reserva.motivo || s.reserva.rankingNome || undefined;
        const status =
          s.reserva.status === 'pendente' ? ' · aguardando confirmação' : '';

        return (
          <View key={key} style={[styles.card, styles.cardOcupado]}>
            <View style={styles.rowTop}>
              <Text style={styles.hora}>{hora}</Text>
              <View style={[styles.badge, { backgroundColor: bc.bg }]}>
                <Text style={[styles.badgeTxt, { color: bc.fg }]}>
                  {labelTipoReserva(s.reserva.tipo)}
                </Text>
              </View>
            </View>
            <Text style={styles.quadra}>{s.quadraNome}</Text>
            {s.reserva.duracaoMin ? (
              <Text style={styles.detail}>{s.reserva.duracaoMin} min</Text>
            ) : null}
            {nomes ? (
              <Text style={styles.detail}>
                {nomes}
                {status}
              </Text>
            ) : status ? (
              <Text style={styles.detail}>{status.trim()}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardLivre: {},
  cardOcupado: { opacity: 0.95 },
  cardOn: { borderColor: Colors.accent, backgroundColor: 'rgba(199,217,65,0.12)' },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hora: { color: Colors.white, fontWeight: '700', fontSize: 15, flex: 1 },
  onTxt: { color: Colors.accent },
  quadra: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  detail: { color: Colors.textSecondary, fontSize: 12, marginTop: 6 },
  badge: {
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLivre: { backgroundColor: 'rgba(199,217,65,0.15)' },
  badgeLivreTxt: { color: Colors.accent, fontSize: 11, fontWeight: '700' },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
});
