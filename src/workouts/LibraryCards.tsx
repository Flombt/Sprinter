import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Copy, Divider, Icon, Label, Metric, MetricGrid, Panel, styles } from '../ui/components';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { interaction, layout, radii, spacing } from '../ui/tokens';
import { segmentGoal } from './definition';
import { referencePresentation, workoutPresentation } from './presentation';
import type { WorkoutBlock, WorkoutDefinition, WorkoutKind } from './types';

function blockLabel(block: WorkoutBlock): string {
  if (block.kind === 'segment') return `${block.name} · ${segmentGoal(block)}`;
  return `${block.count} × (${block.blocks.slice(0, 3).map(blockLabel).join(' / ')}${block.blocks.length > 3 ? ' / …' : ''})`;
}

export function WorkoutOverview({ definition, valid = true, plan = false }: { definition: WorkoutDefinition; valid?: boolean; plan?: boolean }) {
  const { colors } = useTheme();
  const info = useMemo(() => { if (!valid) return null; try { return workoutPresentation(definition); } catch { return null; } }, [definition, valid]);
  return <Panel variant="metric" style={{ gap: spacing.lg }}><Label>Aperçu de la séance</Label>
    {info ? <><View style={[styles.row, { flexWrap: 'wrap', gap: spacing.sm }]}><Copy variant="emphasis">{info.type}</Copy><Copy variant="caption" muted>Structure {info.complexity.toLowerCase()}</Copy></View>
      <MetricGrid><Metric label="Volume prévu" value={info.volume} /><Metric label="Organisation" value={info.structure} /></MetricGrid>
      <Copy variant="caption">{info.goal}</Copy>
      {info.detail && <Copy variant="caption" muted>{info.detail}</Copy>}
      {plan && <><Divider /><View style={{ gap: spacing.md }}><Label>Le déroulé en un regard</Label>
        {definition.blocks.slice(0, 5).map((block, index) => <View key={block.id} style={[styles.row, { alignItems: 'flex-start', gap: spacing.md }]}>
          <Copy variant="caption" style={{ color: colors.secondary, fontWeight: '700' }}>{index + 1}.</Copy><Copy variant="caption" style={{ flex: 1 }}>{blockLabel(block)}</Copy>
        </View>)}
        {definition.blocks.length > 5 && <Copy variant="small" muted>Et {definition.blocks.length - 5} autres blocs, modifiables ci-dessous.</Copy>}
      </View></>}
    </> : <Copy variant="caption" muted>Complétez les champs pour actualiser l’aperçu. Tous les blocs restent modifiables ci-dessous.</Copy>}
  </Panel>;
}

interface WorkoutCardProps {
  title: string; description?: string; definition?: WorkoutDefinition; kind: WorkoutKind;
  origin: 'Modèle' | 'Défi' | 'Ma séance' | 'Dernière séance'; note?: string; selected?: boolean;
  favorite?: boolean; onFavorite?: () => void; disabled?: boolean;
  action: { title: string; onPress: () => void };
  onDetail?: () => void;
  management?: { edit: () => void; duplicate: () => void; remove: () => void };
}
export function WorkoutCard({ title, description, definition, kind, origin, note, selected, favorite = false, onFavorite, disabled = false, action, onDetail, management }: WorkoutCardProps) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout(); const [managing, setManaging] = useState(false);
  const info = useMemo(() => { try { return definition ? workoutPresentation(definition) : kind === 'ghost' || kind === 'personalBest' ? referencePresentation(kind) : null; } catch { return null; } }, [definition, kind]);
  return <Panel variant="list" style={{ gap: spacing.md, borderWidth: 1, borderColor: selected ? colors.accentText : 'transparent' }}>
    <View style={[styles.row, { alignItems: 'flex-start', gap: spacing.sm }]}>
      <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}><Label>{origin}{info ? ` · ${info.type}` : ''}{origin === 'Ma séance' && definition && definition.challenge.kind !== 'none' ? ' · Défi' : ''}</Label>
        <Copy accessibilityRole="header" variant="section">{title}</Copy>
      </View>
      {onFavorite && <Pressable accessibilityRole="button" accessibilityLabel={`${favorite ? 'Retirer' : 'Ajouter'} ${title} ${favorite ? 'des' : 'aux'} favoris`}
        accessibilityState={{ selected: favorite, disabled }} disabled={disabled} onPress={onFavorite}
        style={({ pressed }) => ({ width: layout.touch, height: layout.touch, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.raised : 'transparent', opacity: disabled ? interaction.disabledOpacity : 1 })}>
        <Icon name={favorite ? 'star' : 'star-outline'} color={favorite ? colors.accentText : colors.secondary} />
      </Pressable>}
    </View>
    {note && <Copy variant="caption" muted>{note}</Copy>}
    {selected && <View style={[styles.row, { gap: spacing.xs }]}><Icon name="checkmark-circle" size={16} color={colors.accentText} /><Copy variant="caption" style={{ color: colors.accentText }}>Choisie pour la prochaine sortie</Copy></View>}
    {description && <Copy variant="caption" muted numberOfLines={largeText ? undefined : 2}>{description}</Copy>}
    {info ? <><View style={[styles.row, { flexWrap: 'wrap', gap: spacing.sm }]}>
      <Copy variant="caption" style={{ fontWeight: '600' }}>Prévu · {info.volume}</Copy><Copy variant="caption" muted>· {info.structure}</Copy>
    </View><Copy variant="small" muted>Structure {info.complexity.toLowerCase()}</Copy>
      <Copy variant="caption"><Copy variant="caption" style={{ fontWeight: '600' }}>Objectif · </Copy>{info.goal}</Copy>
      {info.detail && <Copy variant="small" muted>{info.detail}</Copy>}
    </> : <Copy variant="caption" muted>Configuration à vérifier dans l’éditeur.</Copy>}
    <View style={[styles.row, { gap: spacing.sm }]}><Button title={action.title} variant="secondary" onPress={action.onPress} disabled={disabled} style={{ flex: 1 }} />
      {management && <Pressable accessibilityRole="button" accessibilityLabel={`Gérer ${title}`} accessibilityState={{ expanded: managing, disabled }} disabled={disabled}
        onPress={() => setManaging(value => !value)} style={({ pressed }) => ({ width: layout.touch, minHeight: layout.touch, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1 })}><Icon name="ellipsis-horizontal" /></Pressable>}
    </View>
    {onDetail && <Button title="Voir le dernier bilan" variant="quiet" icon="arrow-forward" onPress={onDetail} />}
    {management && managing && <View style={{ gap: spacing.sm }}><Divider /><Button title="Modifier les blocs" variant="secondary" onPress={management.edit} disabled={disabled} />
      <View style={{ flexDirection: largeText ? 'column' : 'row', gap: spacing.sm }}>
        <Button title="Dupliquer" variant="quiet" icon="copy-outline" onPress={management.duplicate} disabled={disabled} style={largeText ? undefined : { flex: 1 }} />
        <Button title="Supprimer" variant="quiet" danger icon="trash-outline" onPress={management.remove} disabled={disabled} style={largeText ? undefined : { flex: 1 }} />
      </View>
    </View>}
  </Panel>;
}
