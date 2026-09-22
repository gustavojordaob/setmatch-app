import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from './useAuth';
import {
  listarProximosConfrontosTorneio,
  listarTorneiosDoJogador,
  type ConfrontoTorneioUsuario,
  type InscricaoTorneioUsuario,
} from '../services/confrontosUsuario';

export function useConfrontosTorneio(uidOverride?: string) {
  const { user } = useAuth();
  const uid = uidOverride || user?.uid;
  const [proximos, setProximos] = useState<ConfrontoTorneioUsuario[]>([]);
  const [torneios, setTorneios] = useState<InscricaoTorneioUsuario[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    if (!uid) {
      setProximos([]);
      setTorneios([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        listarProximosConfrontosTorneio(uid),
        listarTorneiosDoJogador(uid),
      ]);
      setProximos(c);
      setTorneios(t);
    } catch (e) {
      console.warn('[confrontosTorneio]', e);
      setProximos([]);
      setTorneios([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { proximos, torneios, loading, refresh: carregar };
}
