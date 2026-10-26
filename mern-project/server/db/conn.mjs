import { MongoClient } from "mongodb";

const connectionString = process.env.ATLAS_URI || "mongodb://localhost:27017";

function log(seviye, mesaj) {
  console.log(`${new Date().toISOString()} ${seviye} ${mesaj}`);
}

const client = new MongoClient(connectionString);

let conn;
try {
  log("INFO", "MongoDB'ye baglaniliyor");
  conn = await client.connect();
  log("INFO", "MongoDB baglantisi kuruldu");
} catch (e) {
  log("ERROR", `MongoDB baglantisi kurulamadi: ${e.message}`);
  process.exit(1);
}

let db = conn.db("sample_training");

export default db;