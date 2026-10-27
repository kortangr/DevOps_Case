import express from "express";
import cors from "cors";
import "./loadEnvironment.mjs";
import records from "./routes/record.mjs";
import healthcheck from "./routes/healthcheck.mjs";

const PORT = 5050;
const app = express();

function log(seviye, mesaj) {
  const an = new Date().toISOString();
  console.log(`${an} ${seviye} ${mesaj}`);
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
    let seviye = "INFO";
    if (kod >= 500) seviye = "ERROR";
    else if (kod >= 400) seviye = "WARN";
    const sure = Date.now() - baslangic;
    const m = req.method;
    const yol = req.originalUrl;
    log(seviye, `${m} ${yol} ${kod} ${sure}ms`);
  });
  next();
});

app.use("/api/record", records);
app.use("/api/healthcheck", healthcheck);

// Rotalardan gelen hatalar buraya düşer.
// 4xx istemci hatasıdır, gerisi sunucu hatasıdır.
function istemciHatasi(err) {
  return err.status >= 400 && err.status < 500;
}

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  const yer = `${req.method} ${req.originalUrl}`;
  if (!istemciHatasi(err)) {
    log("ERROR", `${yer} hata: ${err.message}`);
    const sunucuGovdesi = { hata: "sunucu hatasi" };
    return res.status(500).json(sunucuGovdesi);
  }
  log("WARN", `${yer} gecersiz: ${err.message}`);
  const istemciGovdesi = { hata: "gecersiz istek" };
  res.status(err.status).json(istemciGovdesi);
});

// start the Express server
app.listen(PORT, () => {
  log("INFO", `Server listening on port ${PORT}`);
});