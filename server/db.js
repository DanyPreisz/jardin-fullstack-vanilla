import { MongoClient, ObjectId } from "mongodb";
const uri = process.env.MONGODB_URI || "";
const dbName = process.env.MONGODB_DB || "jardin";
let db;
export function isReady() { return Boolean(db); }
export async function connect() {
  if (!uri) throw new Error("Falta MONGODB_URI");
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db(dbName);
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await db.collection("plants").createIndex({ userId: 1, name: 1 });
  await db.collection("waters").createIndex({ userId: 1, plantId: 1, day: -1 });
  console.log(`MongoDB conectado (${dbName})`);
  return db;
}
export const users = () => db.collection("users");
export const plants = () => db.collection("plants");
export const waters = () => db.collection("waters");
export function toId(value) { return ObjectId.isValid(value) ? new ObjectId(String(value)) : null; }
export function mapPlant(doc) { return { id: String(doc._id), name: doc.name, place: doc.place || "", photo: doc.photo || "" }; }
export function mapWater(doc) { return { id: String(doc._id), plantId: doc.plantId, day: doc.day }; }
