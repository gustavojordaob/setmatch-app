import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, InputColors } from '../constants/colors';
import { useClube, type ClubeOpcao } from '../contexts/ClubeContext';
import { useAuth } from '../hooks/useAuth';

type Props = {
  /** Se true, inclui opção "Todos" */
  allowTodos?: boolean;
};

type FiltroClube = 'todos' | 'perto' | 'meus';

function norm(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Combo de clube: busca por nome + filtros (perto de mim / meus / todos). */
export function ClubeSwitcher({ allowTodos = true }: Props) {
  const { clubeAtivoId, setClubeAtivoId, clubesDisponiveis, clubeAtivo } =
    useClube();
  const { perfil } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroClube>('todos');

  const minhaCidade = perfil?.cidade?.trim() || '';

  const lista = useMemo(() => {
    let base: ClubeOpcao[] = clubesDisponiveis;
    if (filtro === 'meus') {
      base = base.filter((c) => c.vinculo);
    } else if (filtro === 'perto' && minhaCidade) {
      const city = norm(minhaCidade);
      base = base.filter((c) => {
        const cc = norm(c.cidade || '');
        return cc.includes(city) || city.includes(cc);
      });
    }
    const q = norm(busca);
    if (q) {
      base = base.filter(
        (c) =>
          norm(c.nome).includes(q) ||
          norm(c.cidade || '').includes(q)
      );
    }
    return base;
  }, [clubesDisponiveis, filtro, busca, minhaCidade]);

  const labelSelecionado = clubeAtivo
    ? `${clubeAtivo.vinculo ? '★ ' : ''}${clubeAtivo.nome}`
    : 'Todos os clubes';

  function selecionar(id: string | null) {
    setClubeAtivoId(id);
    setAberto(false);
    setBusca('');
  }

  if (clubesDisponiveis.length === 0) {
    return (
      <Text style={styles.empty}>
        Nenhum clube neste esporte ainda. Explore rankings ou peça aulas.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Clube</Text>
      <TouchableOpacity
        style={styles.combo}
        onPress={() => setAberto(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="business-outline" size={18} color={Colors.accent} />
        <View style={styles.comboTextWrap}>
          <Text style={styles.comboValue} numberOfLines={1}>
            {labelSelecionado}
          </Text>
          {clubeAtivo?.cidade ? (
            <Text style={styles.comboSub} numberOfLines={1}>
              {clubeAtivo.cidade}
            </Text>
          ) : (
            <Text style={styles.comboSub}>Toque para buscar ou filtrar</Text>
          )}
        </View>
        <Ionicons name="chevron-down" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>

      <Modal
        visible={aberto}
        animationType="slide"
        transparent
        onRequestClose={() => setAberto(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAberto(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Selecionar clube</Text>

          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Pesquisar nome ou cidade…"
              placeholderTextColor={InputColors.placeholder}
              value={busca}
              onChangeText={setBusca}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {busca ? (
              <TouchableOpacity onPress={() => setBusca('')}>
                <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.filtros}>
            {(
              [
                { id: 'todos' as const, label: 'Todos' },
                {
                  id: 'perto' as const,
                  label: minhaCidade ? `Perto de mim` : 'Perto de mim',
                  disabled: !minhaCidade,
                },
                { id: 'meus' as const, label: 'Meus clubes' },
              ] as const
            ).map((f) => {
              const on = filtro === f.id;
              const disabled = 'disabled' in f && f.disabled;
              return (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.filtroChip,
                    on && styles.filtroOn,
                    disabled && styles.filtroDisabled,
                  ]}
                  disabled={disabled}
                  onPress={() => setFiltro(f.id)}
                >
                  <Text
                    style={[styles.filtroTxt, on && styles.filtroTxtOn]}
                    numberOfLines={1}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {filtro === 'perto' && minhaCidade ? (
            <Text style={styles.filtroHint}>
              Clubes em {minhaCidade} (e região pelo nome da cidade)
            </Text>
          ) : null}
          {filtro === 'perto' && !minhaCidade ? (
            <Text style={styles.filtroHint}>
              Cadastre sua cidade no perfil para filtrar perto de você.
            </Text>
          ) : null}

          <FlatList
            data={lista}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            style={{ flexGrow: 0, maxHeight: 360 }}
            ListHeaderComponent={
              allowTodos ? (
                <TouchableOpacity
                  style={[styles.item, !clubeAtivoId && styles.itemOn]}
                  onPress={() => selecionar(null)}
                >
                  <Text style={styles.itemNome}>Todos os clubes</Text>
                  <Text style={styles.itemSub}>Sem filtro de clube</Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <Text style={styles.listaEmpty}>
                Nenhum clube com esse nome ou filtro.
              </Text>
            }
            renderItem={({ item }) => {
              const on = item.id === clubeAtivoId;
              return (
                <TouchableOpacity
                  style={[styles.item, on && styles.itemOn]}
                  onPress={() => selecionar(item.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemNome} numberOfLines={1}>
                      {item.vinculo ? '★ ' : ''}
                      {item.nome}
                    </Text>
                    <Text style={styles.itemSub} numberOfLines={1}>
                      {item.cidade || 'Cidade não informada'}
                      {item.vinculo ? ' · seu clube' : ''}
                    </Text>
                  </View>
                  {on ? (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.fechar} onPress={() => setAberto(false)}>
            <Text style={styles.fecharTxt}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  label: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.85,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  combo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  comboTextWrap: { flex: 1 },
  comboValue: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
  comboSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  empty: {
    color: Colors.textPrimary,
    opacity: 0.7,
    fontSize: 12,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  sheetTitle: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    paddingVertical: 0,
  },
  filtros: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  filtroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 60,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filtroOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filtroDisabled: { opacity: 0.4 },
  filtroTxt: { color: Colors.textPrimary, fontWeight: '700', fontSize: 12 },
  filtroTxtOn: { color: Colors.textOnAccent },
  filtroHint: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginBottom: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 4,
  },
  itemOn: { backgroundColor: Colors.surface },
  itemNome: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
  itemSub: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  listaEmpty: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },
  fechar: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  fecharTxt: { color: Colors.accent, fontWeight: '800' },
});
