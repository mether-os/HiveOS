import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not defined in the environment");
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri!);
  await client.connect();
  console.log("[Realtime DB] Connected to MongoDB Atlas");
  db = client.db();
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log("[Realtime DB] Connection closed");
  }
}
