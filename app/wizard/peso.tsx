import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { RulerPicker, UnitToggle } from '../../components/wizard/RulerPicker';
import { useWizard } from '../../contexts/WizardContext';
import { useT } from '../../hooks/useI18n';

export default function WizardPesoScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const [unit, setUnit] = useState<'left' | 'right'>('left');
  const values = useMemo(() => Array.from({ length: 171 }, (_, i) => 30 + i), []);
  const [peso, setPeso] = useState(draft.peso && draft.peso > 0 ? draft.peso : 75);

  function continuar() {
    setDraft({ peso });
    router.push('/wizard/altura');
  }

  return (
    <WizardLayout title={t('wizard.weightTitle')} onContinue={continuar}>
      <UnitToggle left="KG" right="LB" active={unit} onChange={setUnit} />
      <RulerPicker values={values} value={peso} onChange={setPeso} />
    </WizardLayout>
  );
}
