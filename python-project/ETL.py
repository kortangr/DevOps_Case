"""Bagimlilik guncellik izleyicisi (GitHub ETL).

Her izlenen reponun son surumunu GitHub API'den alir (extract),
kayit icin gerekli alanlari secer (transform), MongoDB'ye yazar
(load). Ayni repo tekrar islenince kayit guncellenir, yeni kayit
acilmaz. Sabitlenen surum eskiyse loga uyari yazilir.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone

import requests
from pymongo import MongoClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("etl")

GITHUB_API = "https://api.github.com"
MONGO_URI = os.environ.get("ATLAS_URI", "mongodb://localhost:27017")
DB_NAME = os.environ.get("ETL_DB", "github_etl")
COLLECTION = os.environ.get("ETL_COLLECTION", "repositories")
REPO_LISTESI = os.environ.get(
    "ETL_REPO_LISTESI",
    os.path.join(os.path.dirname(__file__), "izlenen_repolar.json"),
)


def listeyi_oku():
    with open(REPO_LISTESI, encoding="utf-8") as dosya:
        return json.load(dosya)


def github_get(yol):
    log.info("GitHub istegi: %s", yol)
    return requests.get(
        GITHUB_API + yol,
        headers={"Accept": "application/vnd.github+json"},
        timeout=15,
    )


def repo_bilgisi_al(repo):
    cevap = github_get(f"/repos/{repo}")
    cevap.raise_for_status()
    return cevap.json()


def son_surum_al(repo):
    cevap = github_get(f"/repos/{repo}/releases/latest")
    if cevap.status_code == 404:
        log.info("%s: yayinlanmis surum yok", repo)
        return None
    cevap.raise_for_status()
    return cevap.json()


def guncel_mi(sabit, son):
    if sabit is None or son is None:
        return None
    return son == sabit or son.startswith(sabit + ".")


def donustur(repo, surum, ayar):
    son = surum["tag_name"] if surum else None
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
        "son_surum_tarihi": surum["published_at"] if surum else None,
        "guncel_mi": guncel_mi(sabit, son),
    }


def yukle(koleksiyon, repo_id, belge):
    simdi = datetime.now(timezone.utc).isoformat()
    sonuc = koleksiyon.update_one(
        {"_id": repo_id},
        {
            "$set": {**belge, "etl_son_calisma": simdi},
            "$setOnInsert": {"etl_ilk_kayit": simdi},
        },
        upsert=True,
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
            "%s: sabitlenen %s, son surum %s -> yeni surum var",
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
        log.info("%s: %s (id=%s)", repo_adi, durum, repo["id"])
        logla_surum(belge)
        return True
    except Exception:
        log.exception("%s: islenemedi", repo_adi)
        return False


def main():
    log.info("ETL basladi")
    liste = listeyi_oku()
    log.info("Izlenecek repo sayisi: %d", len(liste))
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=10000)
    koleksiyon = client[DB_NAME][COLLECTION]
    sonuclar = [isle(ayar, koleksiyon) for ayar in liste]
    basarili = sonuclar.count(True)
    basarisiz = sonuclar.count(False)
    toplam = koleksiyon.count_documents({})
    log.info("Basarili: %d, basarisiz: %d", basarili, basarisiz)
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