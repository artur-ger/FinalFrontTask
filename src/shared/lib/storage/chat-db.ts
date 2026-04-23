import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { PersistedState } from '../../types/chat'

interface ChatDB extends DBSchema {
  appState: {
    key: string
    value: PersistedState
  }
}

const DB_NAME = 'gigachat-chat-app'
const DB_VERSION = 1
const STORE_NAME = 'appState'
const STATE_KEY = 'state'

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null

const getDb = (): Promise<IDBPDatabase<ChatDB>> => {
  if (!dbPromise) {
    dbPromise = openDB<ChatDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  return dbPromise
}

export const loadPersistedState = async (): Promise<PersistedState | null> => {
  const db = await getDb()
  const data = await db.get(STORE_NAME, STATE_KEY)
  return data ?? null
}

export const savePersistedState = async (state: PersistedState): Promise<void> => {
  const db = await getDb()
  await db.put(STORE_NAME, state, STATE_KEY)
}
