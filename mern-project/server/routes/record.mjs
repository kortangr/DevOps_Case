import express from "express";
import db from "../db/conn.mjs";
import { ObjectId } from "mongodb";

const router = express.Router();

const SEVIYELER = ["Intern", "Junior", "Senior"];
const METIN_MAKS = 100;
const ID_BICIMI = /^[0-9a-f]{24}$/i;

// Rota fonksiyonundaki hatayi hata yakalayiciya iletir.
const sarmala = (fn) => (req, res, next) =>
  fn(req, res, next).catch(next);

// Gecersiz girdi icin hata metni, gecerliyse null doner.
function girdiyiDogrula(govde) {
  if (!govde || typeof govde !== "object") {
    return "Gecersiz istek govdesi";
  }
  for (const alan of ["name", "position"]) {
    const deger = govde[alan];
    if (typeof deger !== "string") {
      return `${alan} metin olmali`;
    }
    const uzunluk = deger.trim().length;
    if (uzunluk < 1 || uzunluk > METIN_MAKS) {
      return `${alan} 1-${METIN_MAKS} karakter olmali`;
    }
  }
  if (!SEVIYELER.includes(govde.level)) {
    return `level su degerlerden biri olmali: ${SEVIYELER.join(", ")}`;
  }
  return null;
}

function temizle(govde) {
  return {
    name: govde.name.trim(),
    position: govde.position.trim(),
    level: govde.level,
  };
}

// :id parametresi gecerli bir ObjectId degilse 400 doner.
function idKontrol(req, res, next) {
  if (!ID_BICIMI.test(req.params.id)) {
    return res.status(400).json({ hata: "Gecersiz id" });
  }
  next();
}

// Tum kayitlari listeler.
router.get("/", sarmala(async (req, res) => {
  const collection = db.collection("records");
  const results = await collection.find({}).toArray();
  res.status(200).send(results);
}));

// Id ile tek kayit getirir.
router.get("/:id", idKontrol, sarmala(async (req, res) => {
  const collection = db.collection("records");
  const query = { _id: new ObjectId(req.params.id) };
  const result = await collection.findOne(query);
  if (!result) {
    return res.status(404).json({ hata: "Kayit bulunamadi" });
  }
  res.status(200).send(result);
}));

// Yeni kayit olusturur.
router.post("/", sarmala(async (req, res) => {
  const hata = girdiyiDogrula(req.body);
  if (hata) {
    return res.status(400).json({ hata });
  }
  const collection = db.collection("records");
  const result = await collection.insertOne(temizle(req.body));
  res.status(201).send(result);
}));

// Id ile kaydi gunceller.
router.patch("/:id", idKontrol, sarmala(async (req, res) => {
  const hata = girdiyiDogrula(req.body);
  if (hata) {
    return res.status(400).json({ hata });
  }
  const query = { _id: new ObjectId(req.params.id) };
  const updates = { $set: temizle(req.body) };
  const collection = db.collection("records");
  const result = await collection.updateOne(query, updates);
  if (result.matchedCount === 0) {
    return res.status(404).json({ hata: "Kayit bulunamadi" });
  }
  res.status(200).send(result);
}));

// Id ile kaydi siler.
router.delete("/:id", idKontrol, sarmala(async (req, res) => {
  const query = { _id: new ObjectId(req.params.id) };
  const collection = db.collection("records");
  const result = await collection.deleteOne(query);
  if (result.deletedCount === 0) {
    return res.status(404).json({ hata: "Kayit bulunamadi" });
  }
  res.status(200).send(result);
}));

export default router;