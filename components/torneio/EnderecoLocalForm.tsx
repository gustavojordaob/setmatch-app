import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Input } from '../ui/Input';

export type EnderecoFormValue = {
  localNome: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type Props = {
  value: EnderecoFormValue;
  onChange: (next: EnderecoFormValue) => void;
  buscandoCep?: boolean;
  onCepChange: (raw: string) => void;
  /** Prefixo nos labels (default vazio). */
  tituloSecao?: string;
};

/** Mesmo padrão do cadastro de clube: CEP → ViaCEP + campos editáveis. */
export function EnderecoLocalForm({
  value,
  onChange,
  buscandoCep,
  onCepChange,
  tituloSecao = 'Local do torneio',
}: Props) {
  const patch = (p: Partial<EnderecoFormValue>) => onChange({ ...value, ...p });

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>{tituloSecao}</Text>
      <Text style={styles.hint}>
        Informe o nome do clube/local (visível aos jogadores). Digite o CEP para preencher
        endereço, bairro, cidade e UF — ajuste o que faltar.
      </Text>
      <Input
        label="Nome do clube / local"
        value={value.localNome}
        onChangeText={(localNome) => patch({ localNome })}
        placeholder="Ex.: Arena Tennis SP"
      />
      <Input
        label="CEP"
        value={value.cep}
        onChangeText={onCepChange}
        keyboardType="number-pad"
        placeholder="00000-000"
      />
      {buscandoCep ? (
        <View style={styles.cepRow}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <Text style={styles.hint}>Buscando endereço…</Text>
        </View>
      ) : null}
      <Input
        label="Endereço"
        value={value.endereco}
        onChangeText={(endereco) => patch({ endereco })}
        placeholder="Rua, número"
      />
      <Input
        label="Bairro"
        value={value.bairro}
        onChangeText={(bairro) => patch({ bairro })}
      />
      <Input
        label="Cidade"
        value={value.cidade}
        onChangeText={(cidade) => patch({ cidade })}
      />
      <Input
        label="UF"
        value={value.estado}
        onChangeText={(estado) => patch({ estado: estado.toUpperCase() })}
        maxLength={2}
        autoCapitalize="characters"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  section: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 6,
    marginTop: 8,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 16,
  },
  cepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
});
