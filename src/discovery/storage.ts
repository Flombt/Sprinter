import { accountKv } from '../account/kv';
import { discoveryPreferenceStore } from './preferences';

export const discoveryStorage = discoveryPreferenceStore(accountKv);
