import { spacing } from '../ui/tokens';
import { useState } from 'react';
import { View } from 'react-native';
import { RunRecord } from '../core/types';
import { km } from '../core/format';
import { uid } from '../workouts/definition';
import { Button, Copy, Header, Label, Panel, Screen } from '../ui/components';
import { confirm } from '../ui/confirm';
import { useProgression } from './hooks';
import { progression } from './store';
import { shoeMileage } from './aggregates';
import { Field, numberValue } from './ui';
import type { Shoe } from './types';
export function Shoes({ history, onBack }: { history: RunRecord[]; onBack: () => void }) {
  const state = useProgression(); const [editing, setEditing] = useState<Shoe | null>(null), [name, setName] = useState(''), [initial, setInitial] = useState('0');
  const edit = (shoe?: Shoe) => { setEditing(shoe ?? { id: uid(), name: '', initialMeters: 0, archived: false, createdAt: Date.now() }); setName(shoe?.name ?? ''); setInitial(String((shoe?.initialMeters ?? 0) / 1000)); };
  const save = async () => { if (editing && await progression.saveShoe({ ...editing, name: name.trim(), initialMeters: numberValue(initial) * 1000 })) setEditing(null); };
  return <Screen bottom={40}><Header title="Mes chaussures" onBack={onBack} /><Copy muted>Le kilométrage provient des activités attribuées à chaque paire. Le kilométrage initial est une valeur déclarée, affichée séparément.</Copy>
    {state.message && <Copy accessibilityRole="alert">{state.message}</Copy>}
    {editing ? <Panel style={{ gap: spacing.md }}><Field label="Nom de la paire" value={name} onChange={setName} /><Field label="Kilométrage avant Sprinter (km)" value={initial} numeric onChange={setInitial} />
      <Button title="Enregistrer la paire" disabled={state.busy} onPress={() => void save()} /><Button title="Annuler" secondary onPress={() => setEditing(null)} /></Panel> : <Button title="Ajouter une paire" icon="add" disabled={!state.ready} onPress={() => edit()} />}
    {!state.data.shoes.length && <Copy muted>Aucune paire enregistrée. Attribuez ensuite une paire avant le départ ou dans le journal d’une ancienne activité.</Copy>}
    {state.data.shoes.map(shoe => { const mileage = shoeMileage(history, state.data, shoe.id); return <Panel key={shoe.id} style={{ gap: spacing.md }}><Label>{shoe.archived ? 'Archivée' : state.data.defaultShoeId === shoe.id ? 'Pour les prochaines sorties' : 'Paire active'}</Label>
      <Copy variant="section">{shoe.name}</Copy><Copy>{km(mileage.totalMeters)} km au total</Copy><Copy muted variant="caption">{km(mileage.measuredMeters)} km enregistrés sur {mileage.runs} sorties + {km(shoe.initialMeters)} km déclarés avant Sprinter.</Copy>
      {!shoe.archived && <Button title={state.data.defaultShoeId === shoe.id ? 'Retirer le choix par défaut' : 'Choisir pour les prochaines sorties'} secondary disabled={state.busy} onPress={() => void progression.selectShoe(state.data.defaultShoeId === shoe.id ? null : shoe.id)} />}
      <Button title="Modifier la paire" secondary disabled={state.busy} onPress={() => edit(shoe)} /><Button title={shoe.archived ? 'Réactiver' : 'Archiver'} secondary disabled={state.busy} onPress={() => confirm(shoe.archived ? 'Réactiver cette paire ?' : 'Archiver cette paire ?', 'Les activités et le kilométrage déjà attribués restent conservés.', 'Continuer', () => { void progression.saveShoe({ ...shoe, archived: !shoe.archived }); })} />
    </Panel>; })}
    <View><Copy muted variant="small">Aucun seuil universel de remplacement n’est imposé. Une attribution modifiée ou une activité supprimée recalcule le kilométrage enregistré.</Copy></View>
  </Screen>;
}
