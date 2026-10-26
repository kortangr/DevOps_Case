import express from "express";
import cors from "cors";
import "./loadEnvironment.mjs";
import records from "./routes/record.mjs";
import healthcheck from "./routes/healthcheck.mjs";

const PORT = 5050;
const app = express();

function log(seviye, mesaj) {
  console.log(`${new Date().toISOString()} ${seviye} ${mesaj}`);
}

app.use(cors());
app.use(express.json());

// Her istek bittiğinde bir satır yazar.
// Sağlık kontrolü log'u doldurmasın diye atlanır.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/healthcheck")) {
    return next();
  }
  const baslangic = Date.now();
  res.on("finish", () => {
    const kod = res.statusCode;
    const seviye = kod >= 500 ? "ERROR" : kod >= 400 ? "WARN" : "INFO";
    const sure = Date.now() - baslangic;
    log(seviye, `${req.method} ${req.originalUrl} ${kod} ${sure}ms`);
  });
  next();
});

app.use("/api/record", records);
app.use("/api/healthcheck", healthcheck);

// Beklenmeyen route hataları buraya düşer.
app.use((err, req, res, next) => {
  const yer = `${req.method} ${req.originalUrl}`;
  log("ERROR", `${yer} beklenmeyen hata: ${err.message}`);
  res.status(500).json({ hata: "sunucu hatasi" });
});

// start the Express server
app.listen(PORT, () => {
  log("INFO", `Server listening on port ${PORT}`);
});