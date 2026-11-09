/** Browser preview does not pretend to offer a clock-accurate background audio loop. */
export class Metronome {
  constructor(_onError: (message: string) => void) {}
  configure(_enabled: boolean, _bpm: number, _volume: number) {}
}
