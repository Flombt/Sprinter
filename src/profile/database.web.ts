// Version web : le profil personnalisé n'est pas proposé dans le navigateur (comme la synchronisation).
import type { SqlDatabase } from '../storage/repository';

const unavailable = async (): Promise<never> => { throw new Error('profile_unavailable_on_web'); };
export const profileDatabase: SqlDatabase = { execAsync: unavailable, runAsync: unavailable, getFirstAsync: unavailable, getAllAsync: unavailable };
