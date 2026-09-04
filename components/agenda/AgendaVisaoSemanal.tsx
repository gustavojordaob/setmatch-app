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
import { Radius } from '../../constants/radius';
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
  addDiasISO,
  diaDentroDaJanela,
  formatDiaSecao,
  listaDiasISO,
  parseDiaISO,
  toDiaISO,
  todayISO,
} from '../../utils/agendaDatas';

const DIAS_POR_PAGINA = 7;

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
  /** Início da visão (default: hoje) */
  inicioISO?: string;
  selecionavel?: boolean;
  slotSel?: SlotLivre | null;
  onSelectLivre?: (s: SlotLivre) => void;
};

export function AgendaVisaoSemanal({
  clubeId,
  agenda,
  quadras,
  locale,
  quadraId,
  inicioISO,
  selecionavel,
  slotSel,
  onSelectLivre,
}: Props) {
  const start = inicioISO ?? todayISO();
  const [paginas, setPaginas] = useState(1);
  const [blocos, setBlocos] = useState<DiaBloc[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});

  const dias = useMemo(
    () =>
      listaDiasISO(start, DIAS_POR_PAGINA * paginas).filter((d) =>
        diaDentroDaJanela(d, agenda.mesesAntecipacao)
      ),
    [start, paginas, agenda.mesesAntecipacao]
  );

  const carregar = useCallback(async () => {
    if (!clubeId || !agenda.ativo || dias.length === 0) {
      setBlocos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ini = parseDiaISO(dias[0]);
      const fim = parseDiaISO(dias[dias.length - 1]);
      const reservas = await listarReservasClubePeriodo(clubeId, ini, fim);
      const next: DiaBloc[] = dias.map((diaISO) => {
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
        return {
          diaISO,
          grade,
          qtdOcupados: grade.filter((g) => g.kind === 'ocupado').length,
          qtdLivres: grade.filter((g) => g.kind === 'livre').length,
        };
      });
      setBlocos(next);
      setAbertos((prev) => {
        const copy = { ...prev };
        // Abre o primeiro dia com conteúdo se nada aberto ainda
        if (!Object.keys(copy).length && next[0]) {
          copy[next[0].diaISO] = true;
        }
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }, [clubeId, agenda, quadras, dias, quadraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function toggle(diaISO: string) {
    setAbertos((a) => ({ ...a, [diaISO]: !a[diaISO] }));
  }

  const podeMais =
    dias.length > 0 &&
    diaDentroDaJanela(
      addDiasISO(dias[dias.length - 1], 1),
      agenda.mesesAntecipacao
    );

  if (loading && blocos.length === 0) {
    return <ActivityIndicator color={Colors.accent} style={{ marginTop: 16 }} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.titulo}>
        Visão semanal · liberado {agenda.mesesAntecipacao}{' '}
        {agenda.mesesAntecipacao === 1 ? 'mês' : 'meses'} pelo clube
      </Text>
      {blocos.map((b) => {
        const aberto = Boolean(abertos[b.diaISO]);
        return (
          <View key={b.diaISO} style={styles.diaCard}>
            <TouchableOpacity
              style={styles.diaHeader}
              onPress={() => toggle(b.diaISO)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.diaTitulo}>
                  {formatDiaSecao(b.diaISO, locale)}
                </Text>
                <Text style={styles.diaMeta}>
                  {b.qtdLivres} livres · {b.qtdOcupados} ocupados
                </Text>
              </View>
              <Ionicons
                name={aberto ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={Colors.accent}
              />
            </TouchableOpacity>
            {aberto ? (
              <View style={styles.diaBody}>
                <AgendaGradeDia
                  grade={b.grade}
                  selecionavel={selecionavel}
                  slotSel={slotSel}
                  onSelectLivre={onSelectLivre}
                  emptyText="Sem horários neste dia (fora do funcionamento ou lotado)."
                />
              </View>
            ) : null}
          </View>
        );
      })}
      {podeMais ? (
        <TouchableOpacity
          style={styles.mais}
          onPress={() => setPaginas((p) => p + 1)}
          disabled={loading}
        >
          <Text style={styles.maisTxt}>
            {loading ? 'Carregando…' : 'Carregar mais 7 dias'}
          </Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.fim}>
          Fim da janela liberada pelo clube ({agenda.mesesAntecipacao}{' '}
          {agenda.mesesAntecipacao === 1 ? 'mês' : 'meses'}).
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  titulo: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  diaCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  diaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  diaTitulo: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
    textTransform: 'capitalize',
  },
  diaMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  diaBody: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  mais: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    alignItems: 'center',
  },
  maisTxt: { color: Colors.accent, fontWeight: '700' },
  fim: {
    color: Colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
