/** Busca endereço brasileiro pelo CEP (ViaCEP). */

export type EnderecoViaCep = {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

export function soDigitosCep(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8);
}

/** Máscara 00000-000 enquanto digita. */
export function formatarCepDigitando(raw: string): string {
  const d = soDigitosCep(raw);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function cepCompleto(raw: string): boolean {
  return soDigitosCep(raw).length === 8;
}

/**
 * Consulta https://viacep.com.br/ws/{cep}/json/
 * Retorna null se CEP inválido / não encontrado / rede falhou.
 */
export async function buscarEnderecoPorCep(
  raw: string
): Promise<EnderecoViaCep | null> {
  const cep = soDigitosCep(raw);
  if (cep.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      cep?: string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro || !data.localidade || !data.uf) return null;
    return {
      cep: formatarCepDigitando(cep),
      logradouro: String(data.logradouro ?? ''),
      bairro: String(data.bairro ?? ''),
      localidade: String(data.localidade ?? ''),
      uf: String(data.uf ?? '').toUpperCase(),
    };
  } catch {
    return null;
  }
}
