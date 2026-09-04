import { useState } from 'react';
import { useRouter } from 'expo-router';
import { WizardLayout } from '../../components/wizard/WizardLayout';
import { ScrollPicker } from '../../components/wizard/ScrollPicker';
import { useWizard } from '../../contexts/WizardContext';
import { IDADE_MINIMA_APP } from '../../constants/legal';
import { useT } from '../../hooks/useI18n';

export default function WizardIdadeScreen() {
  const router = useRouter();
  const t = useT();
  const { draft, setDraft } = useWizard();
  const [idade, setIdade] = useState(
    draft.idade && draft.idade >= IDADE_MINIMA_APP ? draft.idade : 22
  );

  function continuar() {
    setDraft({ idade });
    router.push('/wizard/genero');
  }

  return (
    <WizardLayout title={t('wizard.ageTitle')} onContinue={continuar} showBack={false}>
      <ScrollPicker min={IDADE_MINIMA_APP} max={90} value={idade} onChange={setIdade} />
    </WizardLayout>
  );
}
