import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { RulerPicker, UnitToggle } from '../../components/wizard/RulerPicker';
import { useWizard } from '../../contexts/WizardContext';

export default function WizardPesoScreen() {
  const router = useRouter();
  const { draft, setDraft } = useWizard();
  const [unit, setUnit] = useState<'left' | 'right'>('left');
  const values = useMemo(() => Array.from({ length: 111 }, (_, i) => 40 + i), []);
  const [peso, setPeso] = useState(draft.peso && draft.peso > 0 ? draft.peso : 75);

  function continuar() {
    setDraft({ peso });
    router.push('/wizard/altura');
  }

  return (
    <WizardLayout title="Qual o seu peso?" onContinue={continuar}>
      <UnitToggle left="KG" right="LB" active={unit} onChange={setUnit} />
      <RulerPicker values={values} value={peso} onChange={setPeso} />
    </WizardLayout>
  );
}
