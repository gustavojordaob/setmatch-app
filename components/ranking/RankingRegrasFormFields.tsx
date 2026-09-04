import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';
import { Input } from '../ui/Input';
import { KEYBOARD_DONE_NATIVE_ID } from '../ui/KeyboardDoneBar';
import { formatosPartidaPorEsporte } from '../../constants/chaveamentosTorneio';
import type { FormatoPartidaTorneioId } from '../../constants/chaveamentosTorneio';
import type { EsporteId } from '../../constants/esportes';
import {
  MODELOS_RANKING,
  type ModeloRankingId,
  type RankingRegrasJogo,
} from '../../types/ranking';

export type RankingRegrasFormState = {
  formato: FormatoPartidaTorneioId;
  modelo: ModeloRankingId;
  jogosPorMes: string;
  enfrentaAcima: string;
  enfrentaAbaixo: string;
  ptsCompleto: string;
  ptsPart: string;
  participacaoVencedor: boolean;
  qtdGrupos: string;
  jogadoresPorGrupo: string;
  textoLivre: string;
};

export function stateFromRegras(r: RankingRegrasJogo): RankingRegrasFormState {
  return {
    formato: r.formatoPartidaId,
    modelo: r.modelo,
    jogosPorMes: String(r.jogosPorMes),
    enfrentaAcima: String(r.enfrentaAcima),
    enfrentaAbaixo: String(r.enfrentaAbaixo),
    ptsCompleto: String(r.ptsJogoCompleto),
    ptsPart: String(r.ptsParticipacao),
    participacaoVencedor: r.participacaoTambemVencedor,
    qtdGrupos: String(r.qtdGrupos ?? 4),
    jogadoresPorGrupo: String(r.jogadoresPorGrupo ?? 4),
    textoLivre: r.textoLivre ?? '',
  };
}

export function regrasFromState(s: RankingRegrasFormState): RankingRegrasJogo {
  return {
    formatoPartidaId: s.formato,
    modelo: s.modelo,
    jogosPorMes: Math.max(1, Number(s.jogosPorMes) || 2),
    enfrentaAcima: Math.max(0, Number(s.enfrentaAcima) || 0),
    enfrentaAbaixo: Math.max(0, Number(s.enfrentaAbaixo) || 0),
    ptsJogoCompleto: Math.max(1, Number(s.ptsCompleto) || 35),
    ptsParticipacao: Math.max(0, Number(s.ptsPart) || 0),
    participacaoTambemVencedor: s.participacaoVencedor,
    qtdGrupos: Math.max(2, Number(s.qtdGrupos) || 4),
    jogadoresPorGrupo: Math.max(2, Number(s.jogadoresPorGrupo) || 4),
    textoLivre: s.textoLivre.trim(),
  };
}

type Props = {
  esporte: EsporteId;
  value: RankingRegrasFormState;
  onChange: (next: RankingRegrasFormState) => void;
};

export function RankingRegrasFormFields({ esporte, value, onChange }: Props) {
  const formatos = formatosPartidaPorEsporte(esporte);
  const patch = (p: Partial<RankingRegrasFormState>) => onChange({ ...value, ...p });

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Como funciona o ranking</Text>
      <Text style={styles.hint}>
        Padrão de academia: escada (acima/abaixo), 2 sets + super tiebreak até 10 ou game até 8,
        35 pts limpos (−1 por game), +5 por jogar. Dá para mudar tudo.
      </Text>

      <Text style={styles.label}>Modelo</Text>
      <View style={styles.chips}>
        {MODELOS_RANKING.map((m) => {
          const on = m.id === value.modelo;
          return (
            <TouchableOpacity
              key={m.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => patch({ modelo: m.id })}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.hint}>
        {MODELOS_RANKING.find((m) => m.id === value.modelo)?.desc}
      </Text>

      <Text style={styles.label}>Formato da partida</Text>
      <View style={styles.chips}>
        {formatos.map((f) => {
          const on = f.id === value.formato;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => patch({ formato: f.id })}
            >
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {value.formato === 'melhor_de_3_stb' ? (
        <Text style={styles.hint}>
          Em português: quem ganhar 2 sets leva. Se cada um ganhar 1 set, não joga o 3º set
          completo — joga um super tiebreak (placar tipo 10–7). Quem fizer 10 pontos primeiro
          (com diferença de 2, se o clube usar) fecha a partida.
        </Text>
      ) : null}

      {value.modelo === 'ladder' || value.modelo === 'grupos' ? (
        <>
          <Input
            label="Jogos por mês (meta)"
            value={value.jogosPorMes}
            onChangeText={(jogosPorMes) => patch({ jogosPorMes })}
            keyboardType="number-pad"
            inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          />
          <Input
            label="Enfrentar quantos acima"
            value={value.enfrentaAcima}
            onChangeText={(enfrentaAcima) => patch({ enfrentaAcima })}
            keyboardType="number-pad"
            inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          />
          <Input
            label="Enfrentar quantos abaixo"
            value={value.enfrentaAbaixo}
            onChangeText={(enfrentaAbaixo) => patch({ enfrentaAbaixo })}
            keyboardType="number-pad"
            inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          />
        </>
      ) : (
        <Input
          label="Jogos por mês (meta)"
          value={value.jogosPorMes}
          onChangeText={(jogosPorMes) => patch({ jogosPorMes })}
          keyboardType="number-pad"
          inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
        />
      )}

      {value.modelo === 'grupos' ? (
        <>
          <Input
            label="Quantidade de grupos"
            value={value.qtdGrupos}
            onChangeText={(qtdGrupos) => patch({ qtdGrupos })}
            keyboardType="number-pad"
            inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          />
          <Input
            label="Jogadores por grupo"
            value={value.jogadoresPorGrupo}
            onChangeText={(jogadoresPorGrupo) => patch({ jogadoresPorGrupo })}
            keyboardType="number-pad"
            inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
          />
        </>
      ) : null}

      <Input
        label="Pts vitória limpa (ex. 35)"
        value={value.ptsCompleto}
        onChangeText={(ptsCompleto) => patch({ ptsCompleto })}
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
      />
      <Input
        label="Pts só por jogar (ex. 5)"
        value={value.ptsPart}
        onChangeText={(ptsPart) => patch({ ptsPart })}
        keyboardType="number-pad"
        inputAccessoryViewID={KEYBOARD_DONE_NATIVE_ID}
      />
      <TouchableOpacity
        style={styles.switchRow}
        onPress={() => patch({ participacaoVencedor: !value.participacaoVencedor })}
      >
        <Text style={styles.label}>
          Vencedor também ganha os pts de participação
        </Text>
        <View style={[styles.toggle, value.participacaoVencedor && styles.toggleOn]}>
          <Text style={styles.toggleTxt}>{value.participacaoVencedor ? 'SIM' : 'NÃO'}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.hint}>
        Assim quem joga sempre pontua no ranking. Vitória limpa ≈{' '}
        {Number(value.ptsCompleto) || 35}
        {value.participacaoVencedor ? ` + ${Number(value.ptsPart) || 0}` : ''} pts.
      </Text>
      <Input
        label="Regras extras (opcional)"
        value={value.textoLivre}
        onChangeText={(textoLivre) => patch({ textoLivre })}
        multiline
        placeholder="Walkover, prazo, horário…"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  section: { color: Colors.accent, fontWeight: '800', fontSize: 16 },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  label: { color: Colors.textPrimary, fontWeight: 'bold', flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipTxt: { color: Colors.textPrimary, fontWeight: '600', fontSize: 12 },
  chipTxtOn: { color: Colors.textOnAccent },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggle: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toggleOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  toggleTxt: { color: Colors.textPrimary, fontWeight: '800', fontSize: 12 },
});
