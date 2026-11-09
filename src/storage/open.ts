import * as SQLite from 'expo-sqlite';
import { RunRepository, StorageRepository } from './repository';
export async function openRepository(): Promise<StorageRepository> {
  return new RunRepository(await SQLite.openDatabaseAsync('sprinter-v1.db'));
}
