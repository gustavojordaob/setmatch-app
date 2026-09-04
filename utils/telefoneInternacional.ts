/** Códigos de discagem (DDI) — app global. */
export type PaisTelefone = {
  iso: string;
  nome: string;
  ddi: string;
  /** Máx. dígitos nacionais (sem DDI) */
  maxNacional: number;
  /** Mín. dígitos nacionais */
  minNacional: number;
};

export const PAISES_TELEFONE: PaisTelefone[] = [
  { iso: 'BR', nome: 'Brasil', ddi: '55', minNacional: 10, maxNacional: 11 },
  { iso: 'US', nome: 'Estados Unidos', ddi: '1', minNacional: 10, maxNacional: 10 },
  { iso: 'CA', nome: 'Canadá', ddi: '1', minNacional: 10, maxNacional: 10 },
  { iso: 'AR', nome: 'Argentina', ddi: '54', minNacional: 10, maxNacional: 12 },
  { iso: 'MX', nome: 'México', ddi: '52', minNacional: 10, maxNacional: 10 },
  { iso: 'PT', nome: 'Portugal', ddi: '351', minNacional: 9, maxNacional: 9 },
  { iso: 'ES', nome: 'Espanha', ddi: '34', minNacional: 9, maxNacional: 9 },
  { iso: 'GB', nome: 'Reino Unido', ddi: '44', minNacional: 10, maxNacional: 10 },
  { iso: 'DE', nome: 'Alemanha', ddi: '49', minNacional: 10, maxNacional: 11 },
  { iso: 'FR', nome: 'França', ddi: '33', minNacional: 9, maxNacional: 9 },
  { iso: 'IT', nome: 'Itália', ddi: '39', minNacional: 9, maxNacional: 10 },
  { iso: 'CL', nome: 'Chile', ddi: '56', minNacional: 9, maxNacional: 9 },
  { iso: 'CO', nome: 'Colômbia', ddi: '57', minNacional: 10, maxNacional: 10 },
  { iso: 'PE', nome: 'Peru', ddi: '51', minNacional: 9, maxNacional: 9 },
  { iso: 'UY', nome: 'Uruguai', ddi: '598', minNacional: 8, maxNacional: 8 },
  { iso: 'PY', nome: 'Paraguai', ddi: '595', minNacional: 9, maxNacional: 9 },
  { iso: 'AU', nome: 'Austrália', ddi: '61', minNacional: 9, maxNacional: 9 },
  { iso: 'JP', nome: 'Japão', ddi: '81', minNacional: 10, maxNacional: 10 },
];

export function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/** Ordena DDI do mais longo ao mais curto para parse. */
const DDI_ORD = [...new Set(PAISES_TELEFONE.map((p) => p.ddi))].sort(
  (a, b) => b.length - a.length
);

export function paisPorDdi(ddi: string): PaisTelefone {
  return PAISES_TELEFONE.find((p) => p.ddi === ddi) ?? PAISES_TELEFONE[0];
}

/**
 * Quebra número salvo (só dígitos, com DDI) em { ddi, nacional }.
 * Números BR antigos (10–11 dígitos sem 55) viram DDI 55.
 */
export function parseTelefoneSalvo(raw: string): { ddi: string; nacional: string } {
  const d = soDigitos(raw);
  if (!d) return { ddi: '55', nacional: '' };

  // Só o DDI, ainda sem número nacional (ex.: "55" enquanto o campo está vazio)
  for (const ddi of DDI_ORD) {
    if (d === ddi) return { ddi, nacional: '' };
  }

  for (const ddi of DDI_ORD) {
    if (d.startsWith(ddi) && d.length > ddi.length) {
      const nacional = d.slice(ddi.length);
      const pais = paisPorDdi(ddi);
      const completo = nacional.length >= pais.minNacional && nacional.length <= pais.maxNacional;
      const digitando = nacional.length < pais.minNacional && d.length <= ddi.length + pais.maxNacional;
      // Completo: 55 + 10/11 dígitos. Digitando: não reciclar o DDI como se fosse DDD.
      if (completo || digitando) {
        return { ddi, nacional };
      }
    }
  }

  // Legado BR sem código do país
  if (d.length >= 10 && d.length <= 11) {
    return { ddi: '55', nacional: d };
  }

  return { ddi: '55', nacional: d };
}

/** Dígitos com DDI — formato canônico no Firestore / WhatsApp. */
export function montarTelefoneE164(ddi: string, nacional: string): string {
  return `${soDigitos(ddi)}${soDigitos(nacional)}`;
}

export function telefoneValido(ddi: string, nacional: string): boolean {
  const n = soDigitos(nacional);
  const pais = paisPorDdi(ddi);
  return n.length >= pais.minNacional && n.length <= pais.maxNacional;
}

export function telefoneSalvoValido(raw: string): boolean {
  const { ddi, nacional } = parseTelefoneSalvo(raw);
  return telefoneValido(ddi, nacional);
}

/** Exibição: +55 (11) 99999-9999 */
export function formatarTelefoneInternacional(raw: string): string {
  const { ddi, nacional } = parseTelefoneSalvo(raw);
  if (!nacional) return ddi ? `+${ddi}` : '';
  const n = soDigitos(nacional);
  if (ddi === '55') {
    if (n.length <= 2) return `+55 (${n}`;
    if (n.length <= 7) return `+55 (${n.slice(0, 2)}) ${n.slice(2)}`;
    return `+55 (${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
  }
  return `+${ddi} ${n}`;
}

/** Formata só a parte nacional enquanto digita (BR com máscara). */
export function formatarNacionalDigitando(ddi: string, nacionalRaw: string): string {
  const n = soDigitos(nacionalRaw);
  const pais = paisPorDdi(ddi);
  const clipped = n.slice(0, pais.maxNacional);
  if (ddi === '55') {
    if (clipped.length <= 2) return clipped;
    if (clipped.length <= 7) return `(${clipped.slice(0, 2)}) ${clipped.slice(2)}`;
    return `(${clipped.slice(0, 2)}) ${clipped.slice(2, 7)}-${clipped.slice(7)}`;
  }
  return clipped;
}
