import { View } from 'react-native';
import type { CoachConfig } from '../core/types';
import { Copy, Divider, Panel, SectionHeading } from '../ui/components';
import { SettingRange, SettingsNotice } from '../ui/settings';
import { spacing } from '../ui/tokens';

export function PrecisionPanel({ value, onChange }: { value: CoachConfig; onChange: (key: keyof CoachConfig, value: number) => void }) {
  return <>
    <SettingsNotice title="Pour la prochaine course" body="Ces réglages sont pris en compte au départ. Une allure précise ignore la tolérance et la marge d’entrée ; le lissage et la durée de confirmation restent actifs. Les objectifs propres aux défis restent définis dans la séance." />
    <View style={{ gap: spacing.md }}><SectionHeading title="Stabilité de l’allure" />
      <Panel variant="setting" style={{ gap: spacing.xl }}>
        <SettingRange title="Fenêtre de lissage" description="Lisser davantage stabilise l’allure affichée, avec une réaction moins immédiate aux changements de rythme."
          value={value.smoothingSeconds} min={10} max={35} onChange={v => onChange('smoothingSeconds', v)} />
        <Divider />
        <SettingRange title="Tolérance de la plage" description="Étend la zone sans alerte autour de la plage cible. Le temps passé en cible reste calculé sur la plage exacte."
          value={value.toleranceSeconds ?? 0} min={0} max={20} unit="s/km" onChange={v => onChange('toleranceSeconds', v)} />
        <Divider />
        <SettingRange title="Marge d’entrée en alerte" description="L’hystérésis ajoute une marge avant de signaler un écart, pour éviter les bascules près d’une limite."
          value={value.hysteresisSeconds} min={0} max={8} unit="s/km" onChange={v => onChange('hysteresisSeconds', v)} />
      </Panel>
    </View>
    <View style={{ gap: spacing.md }}><SectionHeading title="Confirmation des écarts" />
      <Panel variant="setting" style={{ gap: spacing.xl }}>
        <SettingRange title="Durée de confirmation" description="Un écart doit durer au moins ce temps avant d’être confirmé par le moteur d’allure."
          value={value.confirmationSeconds} min={5} max={30} onChange={v => onChange('confirmationSeconds', v)} />
        <Divider />
        <SettingRange title="Répétition d’un écart" description="Délai minimum avant un nouveau signal d’allure. Les réglages du contenu du coach peuvent encore espacer les annonces."
          value={value.repeatSeconds} min={15} max={90} step={5} onChange={v => onChange('repeatSeconds', v)} />
      </Panel>
    </View>
    <View style={{ gap: spacing.md }}><SectionHeading title="Objectif chronométrique" />
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <SettingRange title="Seuil d’avance ou de retard" description="Écart de temps nécessaire pour proposer une annonce sur votre objectif."
          value={value.timeWarningSeconds ?? 15} min={5} max={120} step={5} onChange={v => onChange('timeWarningSeconds', v)} />
        <Copy muted variant="small">Les annonces chronométriques sont espacées d’au moins une minute. Les mesures doivent rester fiables ; augmenter la fréquence ne force pas une annonce.</Copy>
      </Panel>
    </View>
  </>;
}
