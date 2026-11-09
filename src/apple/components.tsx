import { useSyncExternalStore } from 'react';
import type { RunRecord } from '../core/types';
import { Button, Copy, Label, Panel } from '../ui/components';
import { apple } from './store';
import { healthExport } from './mapping';
import { nativeApple, APPLE_BUILD_REQUIRED } from './bridge';

export function HealthSyncPanel({ run, onOpen }: { run: RunRecord; onOpen?: () => void }) {
  const state = useSyncExternalStore(apple.subscribe, apple.getSnapshot, apple.getSnapshot);
  const receipt = state.preferences.receipts.find(r => r.runId === run.id);
  let reason: string | null = null;
  if (!run.healthKit) { try { healthExport(run); } catch (error) { reason = error instanceof Error ? error.message : String(error); } }
  return <Panel style={{ gap: 12 }}><Label>Apple Santé</Label>
    {run.healthKit ? <><Copy>Importée de {run.healthKit.sourceName}.</Copy><Copy muted variant="caption">Distance et temps provenant de Santé. Parcours, objectifs et mesures détaillées indisponibles pour cet import.</Copy></>
      : receipt ? <Copy>Associée à Santé le {new Date(receipt.syncedAt).toLocaleDateString('fr-FR')}. Aucun nouvel envoi automatique de cette course.</Copy>
        : <><Copy muted variant="caption">{!nativeApple ? APPLE_BUILD_REQUIRED : reason ?? 'Envoyer cette course et sa distance après autorisation d’écriture. La course locale est conservée.'}</Copy>
          <Button title="Enregistrer dans Apple Santé" secondary icon="heart-outline" disabled={!nativeApple || !state.ready || state.busy || !!reason} onPress={() => void apple.exportRun(run)} /></>}
    {state.message && <Copy accessibilityRole="alert" muted variant="caption">{state.message}</Copy>}
    {onOpen && <Button title="Permissions et intégrations Apple" secondary onPress={onOpen} />}
  </Panel>;
}
