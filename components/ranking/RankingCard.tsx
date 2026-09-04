import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Radius } from '../../constants/radius';

export type RankingRow = {
  id: string;
  nome: string;
  pts: number;
};

type Props = {
  title: string;
  /** Nome do clube abaixo do ranking */
  subtitle?: string;
  rows: RankingRow[];
  pinned?: boolean;
  /** Logo do clube (lado do título) */
  logoUrl?: string | null;
  /** Fallback se não houver logo */
  badge?: string;
  onVerMais?: () => void;
  onConfrontos?: () => void;
};

const LOGO = 44;

export function RankingCard({
  title,
  subtitle,
  rows,
  pinned,
  logoUrl,
  badge,
  onVerMais,
  onConfrontos,
}: Props) {
  return (
    <View style={styles.card}>
      {pinned ? (
        <View style={styles.fixado}>
          <Text style={styles.fixadoTxt}>FIXADO</Text>
        </View>
      ) : null}

      <View style={styles.head}>
        <View style={styles.headLeft}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} />
          ) : badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{badge}</Text>
            </View>
          ) : null}
          <View style={styles.titles}>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.ptsHead}>PTS</Text>
      </View>

      {rows.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.namePill}>
            <Text style={styles.nameTxt} numberOfLines={1}>
              {r.nome}
            </Text>
          </View>
          <View style={styles.line} />
          <Text style={styles.pts}>{r.pts}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        {onConfrontos ? (
          <TouchableOpacity onPress={onConfrontos} style={styles.confrontosBtn}>
            <Text style={styles.confrontosTxt}>Confrontos</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onVerMais} style={styles.verMais}>
          <Text style={styles.verMaisTxt}>+ver tabela</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: Colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    marginBottom: 20,
    position: 'relative',
  },
  fixado: {
    position: 'absolute',
    top: -10,
    left: 16,
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  fixadoTxt: {
    color: Colors.textOnAccent,
    fontSize: 10,
    fontWeight: 'bold',
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  headLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: 12,
    backgroundColor: Colors.surfaceDark,
    borderWidth: 1,
    borderColor: Colors.white,
  },
  badge: {
    width: LOGO,
    height: LOGO,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  badgeTxt: { color: Colors.white, fontSize: 18, fontWeight: '800' },
  titles: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: 'bold' },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  ptsHead: { color: Colors.textPrimary, fontSize: 18, fontWeight: 'bold' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  namePill: {
    backgroundColor: Colors.pillMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 100,
  },
  nameTxt: { color: Colors.textOnAccent, fontSize: 12, fontWeight: '600' },
  line: { flex: 1, height: 1, backgroundColor: Colors.white, opacity: 0.85 },
  pts: {
    color: Colors.textPrimary,
    fontWeight: '600',
    fontSize: 13,
    minWidth: 32,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    gap: 8,
  },
  confrontosBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  confrontosTxt: { color: Colors.textOnAccent, fontWeight: '800', fontSize: 12 },
  verMais: { alignItems: 'center', paddingTop: 4, paddingHorizontal: 8 },
  verMaisTxt: { color: Colors.textPrimary, fontSize: 12 },
});
