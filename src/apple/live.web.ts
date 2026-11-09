import type { SessionState } from '../services/session';
export class RunLiveController {
  readonly available = false;
  constructor(_onError: (message: string) => void) {}
  async initialize() {}
  observe(_state: SessionState, _enabled: boolean) {}
}
