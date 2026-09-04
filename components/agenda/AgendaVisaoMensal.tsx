import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { AgendaGradeDia } from './AgendaGradeDia';
import type { AppLocale } from '../../i18n/types';
import type {
  AgendaClubeConfig,
  GradeSlot,
  QuadraClube,
  SlotLivre,
} from '../../types/agenda';
import {
  listarReservasClubePeriodo,
  montarGradeDia,
  reservaToDate,
} from '../../services/agenda';
import {
  addMesesISO,
  dataLimiteMeses,
  diaDentroDaJanela,
  formatDiaSecao,
  formatFaixaSemana,
  formatMesAno,
  fimMesISO,
  inicioMesISO,
  parseDiaISO,
  semanasDoMes,
  toDiaISO,
  todayISO,
} from '../../utils/agendaDatas';

type DiaBloc = {
  diaISO: string;
  grade: GradeSlot[];
  qtdOcupados: number;
  qtdLivres: number;
};

type Props = {
  clubeId: string;
  agenda: AgendaClubeConfig;
  quadras: QuadraClube[];
  locale: AppLocale;
  quadraId?: string;
  selecionavel?: boolean;
  slotSel?: SlotLivre | null;
  onSelectLivre?: (s: SlotLivre) => void;
};

export function AgendaVisaoMensal({
  clubeId,
  agenda,
  quadras,
  locale,
  quadraId,
  selecionavel,
  slotSel,
  onSelectLivre,
}: Props) {
  const [mesRef, setMesRef] = useState(() => inicioMesISO(todayISO()));
  const [porDia, setPorDia] = useState<Record<string, DiaBloc>>({});
  const [loading, setLoading] = useState(true);
  const [semanasAbertas, setSemanasAbertas] = useState<Record<number, boolean>>(
    { 0: true }
  );
  const [diasAbertos, setDiasAbertos] = useState<Record<string, boolean>>({});

  const semanas = useMemo(() => semanasDoMes(mesRef), [mesRef]);

  const diasNoMes = useMemo(
    () =>
      semanas
        .flat()
        .filter((d) => diaDentroDaJanela(d, agenda.mesesAntecipacao)),
    [semanas, agenda.mesesAntecipacao]
  );

  const limiteISO = toDiaISO(dataLimiteMeses(agenda.mesesAntecipacao));
  const hojeMes = inicioMesISO(todayISO());
  const podeVoltar = mesRef > hojeMes;
  const podeAvancar = inicioMesISO(mesRef) < inicioMesISO(limiteISO);

  const carregar = useCallback(async () => {
    if (!clubeId || !agenda.ativo) {
      setPorDia({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ini = parseDiaISO(inicioMesISO(mesRef));
      const fim = parseDiaISO(fimMesISO(mesRef));
      const reservas = await listarReservasClubePeriodo(clubeId, ini, fim);
      const map: Record<string, DiaBloc> = {};
      for (const diaISO of semanas.flat()) {
        if (!diaDentroDaJanela(diaISO, agenda.mesesAntecipacao)) continue;
        const dia = parseDiaISO(diaISO);
        const doDia = reservas.filter((r) => {
          const t = reservaToDate(r.inicio);
          return t ? toDiaISO(t) === diaISO : false;
        });
        const grade = montarGradeDia({
          agenda,
          quadras,
          reservas: doDia,
          dia,
          quadraId,
        });
        map[diaISO] = {
          diaISO,
          grade,
          qtdOcupados: grade.filter((g) => g.kind === 'ocupado').length,
          qtdLivres: grade.filter((g) => g.kind === 'livre').length,
        };
      }
      setPorDia(map);
    } finally {
      setLoading(false);
    }
  }, [clubeId, agenda, quadras, mesRef, semanas, quadraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function toggleSemana(i: number) {
    setSemanasAbertas((s) => ({ ...s, [i]: !s[i] }));
  }

  function toggleDia(diaISO: string) {
    setDiasAbertos((d) => ({ ...d, [diaISO]: !d[diaISO] }));
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.mesNav}>
        <TouchableOpacity
          style={[styles.navBtn, !podeVoltar && styles.navDisabled]}
          disabled={!podeVoltar}
          onPress={() => setMesRef((m) => addMesesISO(m, -1))}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.accent} />
        </TouchableOpacity>
        <Text style={styles.mesTitulo}>{formatMesAno(mesRef, locale)}</Text>
        <TouchableOpacity
          style={[styles.navBtn, !podeAvancar && styles.navDisabled]}
          disabled={!podeAvancar}
          onPress={() => setMesRef((m) => addMesesISO(m, 1))}
        >
          <Ionicons name="chevron-forward" size={22} color={Colors.accent} />
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitulo}>
        Separado por semana · toque na semana e no dia para abrir/fechar
      </Text>

      {loading && Object.keys(porDia).length === 0 ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 16 }} />
      ) : diasNoMes.length === 0 ? (
        <Text style={styles.vazio}>
          Nenhum dia deste mês está na janela liberada pelo clube.
        </Text>
      ) : (
        semanas.map((dias, wi) => {
          const diasVisiveis = dias.filter((d) => porDia[d]);
          if (!diasVisiveis.length) return null;
          const livre = diasVisiveis.reduce(
            (a, d) => a + (porDia[d]?.qtdLivres ?? 0),
            0
          );
          const ocup = diasVisiveis.reduce(
            (a, d) => a + (porDia[d]?.qtdOcupados ?? 0),
            0
          );
          const semanaAberta = Boolean(semanasAbertas[wi]);
          return (
            <View key={`w-${wi}`} style={styles.semanaCard}>
              <TouchableOpacity
                style={styles.semanaHeader}
                onPress={() => toggleSemana(wi)}
                activeOpacity={0.85}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.semanaTitulo}>
                    Semana {wi + 1} · {formatFaixaSemana(diasVisiveis, locale)}
                  </Text>
                  <Text style={styles.meta}>
                    {livre} livres · {ocup} ocupados
                  </Text>
                </View>
                <Ionicons
                  name={semanaAberta ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={Colors.accent}
                />
              </TouchableOpacity>

              {semanaAberta
                ? diasVisiveis.map((diaISO) => {
                    const b = porDia[diaISO];
                    if (!b) return null;
                    const diaAberto = Boolean(diasAbertos[diaISO]);
                    return (
                      <View key={diaISO} style={styles.diaWrap}>
                        <TouchableOpacity
                          style={styles.diaHeader}
                          onPress={() => toggleDia(diaISO)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.diaTitulo}>
                              {formatDiaSecao(diaISO, locale)}
                            </Text>
                            <Text style={styles.meta}>
                              {b.qtdLivres} livres · {b.qtdOcupados} ocupados
                            </Text>
                          </View>
                          <Ionicons
                            name={diaAberto ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={Colors.textSecondary}
                          />
                        </TouchableOpacity>
                        {diaAberto ? (
                          <View style={styles.diaBody}>
                            <AgendaGradeDia
                              grade={b.grade}
                              selecionavel={selecionavel}
                              slotSel={slotSel}
                              onSelectLivre={onSelectLivre}
                              emptyText="Sem horários neste dia."
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })
                : null}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  mesNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navDisabled: { opacity: 0.35 },
  mesTitulo: {
    flex: 1,
    textAlign: 'center',
    color: Colors.white,
    fontWeight: '800',
    fontSize: 17,
    textTransform: 'capitalize',
  },
  subtitulo: { color: Colors.textSecondary, fontSize: 12 },
  vazio: { color: Colors.textSecondary, marginTop: 12 },
  semanaCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  semanaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  semanaTitulo: { color: Colors.accent, fontWeight: '800', fontSize: 14 },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  diaWrap: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  diaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  diaTitulo: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  diaBody: { paddingHorizontal: 10, paddingBottom: 12, paddingTop: 4 },
});
