import express from "express";
import db from "../db/conn.mjs";

const router = express.Router();

const MONGO_ZAMAN_ASIMI_MS = 2000;

// MongoDB'ye ping atar; 2 saniyede cevap gelmezse hata sayar.
async function mongoyuYokla() {
  const zamanAsimi = new Promise((_, reddet) =>
    setTimeout(() => reddet(new Error("zaman asimi")), MONGO_ZAMAN_ASIMI_MS)
  );
  await Promise.race([db.command({ ping: 1 }), zamanAsimi]);
}

router.get("/", async (req, res) => {
  const durum = {
    uptime: process.uptime(),
    timestamp: Date.now(),
  };
  try {
    await mongoyuYokla();
    res.status(200).send({ ...durum, message: "OK", mongo: "ok" });
  } catch (e) {
    res.status(503).send({ ...durum, message: "HATA", mongo: e.message });
  }
});

export default router;