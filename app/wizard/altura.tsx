import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { RulerPicker, UnitToggle } from '../../components/wizard/RulerPicker';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardAlturaScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const [unit, setUnit] = useState<'left' | 'right'>('left');
  const values = useMemo(
    () => Array.from({ length: 71 }, (_, i) => (150 + i) / 100),
    []
  );
  const defaultAlt = draft.altura && draft.altura > 0 ? draft.altura / 100 : 1.85;
  const [altura, setAltura] = useState(defaultAlt);

  function continuar() {
    setDraft({ altura: Math.round(altura * 100) });
    router.push('/wizard/esportes');
  }

  return (
    <WizardLayout title="Qual a sua altura?" onContinue={continuar}>
      <UnitToggle left="CM" right="INCH" active={unit} onChange={setUnit} />
      <RulerPicker
        values={values}
        value={altura}
        onChange={setAltura}
        format={(v) => v.toFixed(2)}
      />
    </WizardLayout>
  );
}
