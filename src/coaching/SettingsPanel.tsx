import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChoiceGroup, SegmentedControl, Toggle } from '../ui/controls';
import { Copy, Divider, Icon, Label, Panel, SectionHeading, styles, type IconName } from '../ui/components';
import { SettingRange, SettingsDisclosure, SettingsNotice } from '../ui/settings';
import { useTheme } from '../ui/theme';
import { layout, spacing } from '../ui/tokens';
import { AnnouncementCategory, AnnouncementPriority, CATEGORY_INFO, CoachLevel, CoachingPreferences, coachingPreset } from './config';
import { COACH_LEVEL_DESCRIPTION, coachingSummary } from './presentation';

const GROUPS: { title: string; icon: IconName; keys: AnnouncementCategory[] }[] = [
  { title: 'Allure et objectif', icon: 'speedometer-outline', keys: ['pace', 'recovered', 'timeGoal'] },
  { title: 'Séances et défis', icon: 'flag-outline', keys: ['workout', 'anticipation', 'challenge', 'session'] },
  { title: 'Distance et progression', icon: 'trending-up-outline', keys: ['distance', 'progress'] },
  { title: 'Navigation sur un parcours', icon: 'navigate-outline', keys: ['navigation'] },
];
const PRIORITY_LABEL: Record<AnnouncementPriority, string> = { low: 'Basse', normal: 'Normale', high: 'Haute' };

export function CoachingSettings({ value, onChange }: { value?: CoachingPreferences; onChange: (v: CoachingPreferences) => void }) {
  const { colors } = useTheme(); const { config, customized, enabled } = coachingSummary(value);
  const [expanded, setExpanded] = useState<AnnouncementCategory | null>(null);
  const rule = (key: AnnouncementCategory, patch: Partial<CoachingPreferences['categories'][AnnouncementCategory]>) =>
    onChange({ ...config, categories: { ...config.categories, [key]: { ...config.categories[key], ...patch } } });
  const distance = config.distanceStepMeters < 1000 ? `${config.distanceStepMeters} m` : `${config.distanceStepMeters / 1000} km`;
  return <>
    <View style={{ gap: spacing.md }}><SectionHeading title="Niveau du coach" />
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <Copy muted variant="caption">Choisissez une base, puis ajustez les annonces selon vos habitudes.</Copy>
        <SegmentedControl<CoachLevel> label="Niveau de coaching" value={config.level} choices={[["discreet", "Discret"], ["normal", "Normal"], ["complete", "Complet"]]}
          onChange={level => onChange(coachingPreset(level))} />
        <Copy variant="caption">{COACH_LEVEL_DESCRIPTION[config.level]}</Copy>
        <View style={[styles.row, { flexWrap: 'wrap', gap: spacing.sm }]}>
          <Copy variant="caption" style={{ color: colors.accentText }}>{customized ? 'Personnalisé' : 'Préréglage'}</Copy>
          <Copy muted variant="caption">{enabled} type{enabled > 1 ? 's' : ''} d’annonce activé{enabled > 1 ? 's' : ''}</Copy>
        </View>
        <Copy muted variant="small">Choisir un niveau réapplique son préréglage : types, intervalles, priorités et palier de distance. Vos ajustements ci-dessous remplacent ensuite cette base.</Copy>
      </Panel>
    </View>
    {enabled === 0 && <SettingsNotice title="Aucune annonce sélectionnée" body="Activez un type ci-dessous pour recevoir ses événements. Le moteur de course et l’enregistrement continuent indépendamment." />}
    <SettingsDisclosure title="Rythme des annonces" summary={`Espacement global : ${config.minimumGapSeconds} s · distance : ${distance}`} icon="time-outline">
      <SettingRange title="Espacement global minimum" description="Laisser au moins ce temps entre les annonces ordinaires disponibles."
        value={config.minimumGapSeconds} min={3} max={30} onChange={minimumGapSeconds => onChange({ ...config, minimumGapSeconds })} />
      <Divider />
      <View style={{ gap: spacing.sm }}><Label>Palier de distance</Label>
        <ChoiceGroup<number> label="Palier des annonces de distance" value={config.distanceStepMeters} choices={[[500, '500 m'], [1000, '1 km'], [2000, '2 km'], [5000, '5 km']]}
          onChange={distanceStepMeters => onChange({ ...config, distanceStepMeters })} />
        <Copy muted variant="caption">Ce palier s’applique si « Distance parcourue » est activé et si la distance a été réellement enregistrée.</Copy>
      </View>
      <Copy muted variant="small">Les résultats de défi et fins de séance activés gardent leur priorité, avec au moins deux secondes entre annonces. Les événements anciens expirent ; aucun rattrapage vocal après une pause.</Copy>
    </SettingsDisclosure>
    <View style={{ gap: spacing.md }}><SectionHeading title="Types d’annonces" />
      <Copy muted variant="caption">Choisissez les informations utiles, puis ouvrez « Fréquence et priorité » pour affiner chaque type.</Copy>
      {GROUPS.map(group => {
        const active = group.keys.filter(key => config.categories[key].enabled).length;
        return <SettingsDisclosure key={group.title} title={group.title} icon={group.icon}
          summary={`${active} sur ${group.keys.length} activé${active > 1 ? 's' : ''}`}>
          {group.keys.map((key, index) => {
            const info = CATEGORY_INFO.find(item => item.key === key)!;
            const current = config.categories[key]; const open = expanded === key;
            return <View key={key} style={{ gap: spacing.md }}>
              {index > 0 && <Divider />}
              <Toggle title={info.title} body={info.description} value={current.enabled} onChange={enabled => rule(key, { enabled })} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Fréquence et priorité : ${info.title}`}
                accessibilityHint={`${current.intervalSeconds} secondes minimum. Priorité ${PRIORITY_LABEL[current.priority].toLowerCase()}.`}
                accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : key)}
                style={[styles.row, { minHeight: layout.touch, gap: spacing.sm }]}>
                <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                  <Copy muted variant="caption">Fréquence et priorité</Copy>
                  <Copy variant="small" style={{ color: colors.secondary }}>{current.intervalSeconds} s minimum · {PRIORITY_LABEL[current.priority]}</Copy>
                </View><Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.secondary} />
              </Pressable>
              {open && <View style={{ gap: spacing.lg }}>
                {!current.enabled && <Copy muted variant="caption">Ce type est désactivé. Vous pouvez préparer ses réglages sans l’activer.</Copy>}
                <SettingRange title={`Intervalle · ${info.title}`} value={current.intervalSeconds} min={info.minimum} max={600} step={5}
                  onChange={intervalSeconds => rule(key, { intervalSeconds })} />
                <View style={{ gap: spacing.sm }}><Label>Priorité</Label>
                  <ChoiceGroup<AnnouncementPriority> label={`Priorité : ${info.title}`} value={current.priority} choices={[["low", "Basse"], ["normal", "Normale"], ["high", "Haute"]]}
                    onChange={priority => rule(key, { priority })} />
                </View>
              </View>}
            </View>;
          })}
        </SettingsDisclosure>;
      })}
    </View>
    <Copy muted variant="caption">Un intervalle est un délai minimum, pas une annonce périodique garantie. Les mesures fiables, confirmations et événements réels restent nécessaires. Les résultats finaux gardent leur priorité et ne se répètent pas.</Copy>
  </>;
}
