"""Bagimlilik guncellik izleyicisi (GitHub ETL).

Izlenen her reponun son surumunu GitHub API'den
alir (extract), gerekli alanlari secer (transform)
ve MongoDB'ye yazar (load). Ayni repo tekrar
islenince kayit guncellenir, yeni kayit acilmaz.
Sabitlenen surum eskiyse loga uyari yazilir.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone

import requests
from pymongo import MongoClient
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("etl")

UTC = timezone.utc
GITHUB_API = "https://api.github.com"
KALAN = "X-RateLimit-Remaining"
SIFIRLAMA = "X-RateLimit-Reset"
MONGO_URI = os.environ.get(
    "ATLAS_URI", "mongodb://localhost:27017"
)
DB_NAME = os.environ.get("ETL_DB", "github_etl")
COLLECTION = os.environ.get(
    "ETL_COLLECTION", "repositories"
)
REPO_DIZINI = os.path.dirname(__file__)
VARSAYILAN_LISTE = os.path.join(
    REPO_DIZINI, "izlenen_repolar.json"
)
REPO_LISTESI = os.environ.get(
    "ETL_REPO_LISTESI", VARSAYILAN_LISTE
)


def oturum_olustur():
    # Zaman asimi ve 5xx hatalarinda 3 kez yeniden dener.
    yeniden = Retry(
        total=3,
        backoff_factor=2,
        status_forcelist=[500, 502, 503, 504],
        allowed_methods=["GET"],
    )
    oturum = requests.Session()
    oturum.mount("https://", HTTPAdapter(max_retries=yeniden))
    tur = "application/vnd.github+json"
    oturum.headers["Accept"] = tur
    return oturum


OTURUM = oturum_olustur()


def listeyi_oku():
    with open(REPO_LISTESI, encoding="utf-8") as dosya:
        return json.load(dosya)


def github_get(yol):
    log.info("GitHub istegi: %s", yol)
    return OTURUM.get(GITHUB_API + yol, timeout=15)


def cevabi_kontrol(cevap):
    # Istek siniri dolduysa nedeni acikca loglar.
    kalan = cevap.headers.get(KALAN)
    if cevap.status_code == 403 and kalan == "0":
        ham = cevap.headers.get(SIFIRLAMA, 0)
        zaman = datetime.fromtimestamp(int(ham), UTC)
        log.error(
            "Istek siniri doldu, sifirlanma %s UTC",
            zaman.strftime("%H:%M"),
        )
    cevap.raise_for_status()


def repo_bilgisi_al(repo):
    cevap = github_get(f"/repos/{repo}")
    cevabi_kontrol(cevap)
    return cevap.json()


def son_surum_al(repo):
    cevap = github_get(f"/repos/{repo}/releases/latest")
    if cevap.status_code == 404:
        log.info("%s: yayinlanmis surum yok", repo)
        return None
    cevabi_kontrol(cevap)
    return cevap.json()


def guncel_mi(sabit, son):
    if sabit is None or son is None:
        return None
    return son == sabit or son.startswith(sabit + ".")


def donustur(repo, surum, ayar):
    son = surum["tag_name"] if surum else None
    tarih = surum["published_at"] if surum else None
    sabit = ayar.get("sabitlenen_surum")
    return {
        "full_name": repo["full_name"],
        "html_url": repo["html_url"],
        "description": repo["description"],
        "stargazers_count": repo["stargazers_count"],
        "pushed_at": repo["pushed_at"],
        "nerede": ayar.get("nerede"),
        "sabitlenen_surum": sabit,
        "son_surum": son,
        "son_surum_tarihi": tarih,
        "guncel_mi": guncel_mi(sabit, son),
    }


def yukle(koleksiyon, repo_id, belge):
    simdi = datetime.now(UTC).isoformat()
    guncelle = {
        "$set": {**belge, "etl_son_calisma": simdi},
        "$setOnInsert": {"etl_ilk_kayit": simdi},
    }
    sonuc = koleksiyon.update_one(
        {"_id": repo_id}, guncelle, upsert=True
    )
    if sonuc.upserted_id is not None:
        return "yeni kayit olusturuldu"
    return "mevcut kayit guncellendi"


def logla_surum(belge):
    ad = belge["full_name"]
    if belge["guncel_mi"] is True:
        log.info(
            "%s: sabitlenen %s -> guncel",
            ad,
            belge["sabitlenen_surum"],
        )
    elif belge["guncel_mi"] is False:
        log.warning(
            "%s: sabitlenen %s, son surum %s"
            " -> yeni surum var",
            ad,
            belge["sabitlenen_surum"],
            belge["son_surum"],
        )


def isle(ayar, koleksiyon):
    repo_adi = ayar["repo"]
    try:
        repo = repo_bilgisi_al(repo_adi)
        surum = son_surum_al(repo_adi)
        belge = donustur(repo, surum, ayar)
        durum = yukle(koleksiyon, repo["id"], belge)
        kimlik = repo["id"]
        sablon = "%s: %s (id=%s)"
        log.info(sablon, repo_adi, durum, kimlik)
        logla_surum(belge)
        return True
    except Exception:
        log.exception("%s: islenemedi", repo_adi)
        return False


def main():
    log.info("ETL basladi")
    liste = listeyi_oku()
    log.info("Izlenecek repo sayisi: %d", len(liste))
    client = MongoClient(
        MONGO_URI, serverSelectionTimeoutMS=10000
    )
    koleksiyon = client[DB_NAME][COLLECTION]
    sonuclar = [isle(ayar, koleksiyon) for ayar in liste]
    basarili = sonuclar.count(True)
    basarisiz = sonuclar.count(False)
    toplam = koleksiyon.count_documents({})
    ozet = "Basarili: %d, basarisiz: %d"
    log.info(ozet, basarili, basarisiz)
    log.info("Koleksiyondaki toplam kayit: %d", toplam)
    if basarisiz:
        log.error("ETL kismen basarisiz")
        return 1
    log.info("ETL basariyla bitti")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        log.exception("ETL basarisiz")
        sys.exit(1)     