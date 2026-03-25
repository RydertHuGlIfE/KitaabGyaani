import { openDB } from "idb";

const DB_NAME = "LessonContents";
const STORE_NAME = "subtopicContent";

export async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
}

export async function saveToDB(key: string, value: Record<string, number>) {
  const db = await getDB();
  const data = {
    content: value,
    timestamp: Date.now(),
  };
  await db.put(STORE_NAME, data, key);
}

export async function getFromDB(key: string) {
  const db = await getDB();
  return db.get(STORE_NAME, key);
}

export async function clearDB() {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
