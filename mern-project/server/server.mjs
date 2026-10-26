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

// Her istek bittiğinde bir satır yazar. Sağlık kontrolü log'u doldurmasın diye atlanır.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/healthcheck")) {
    return next();
  }
  const baslangic = Date.now();
  res.on("finish", () => {
    const seviye =
      res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
    log(
      seviye,
      `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - baslan
    );
  });
  next();
});


app.use("/api/healthcheck", healthcheck);

// Beklenmeyen route hataları buraya düşer.
app.use((err, req, res, next) => {
  log("ERROR", `${req.method} ${req.originalUrl} beklenmeyen hata: ${err.message}`);
  res.status(500).json({ hata: "sunucu hatasi" });
});

// start the Express server
app.listen(PORT, () => {
  log("INFO", `Server listening on port ${PORT}`);
});