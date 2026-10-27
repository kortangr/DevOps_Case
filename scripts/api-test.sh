# API testi. Kullanim: bash api-test.sh [ADRES]
# Ornek: bash api-test.sh http://localhost:5050
BASE="${1:-http://localhost:5050}"
KAYIT=/api/record
JSON="Content-Type: application/json"
HATA=0

IYI='{"name":"Ali","position":"QA","level":"Intern"}'
LEVEL='{"name":"Ali","position":"QA","level":"Boss"}'
BOS='{"name":" ","position":"QA","level":"Intern"}'

# Sadece HTTP durum kodunu yazar.
kod() {
  if [ -n "${3:-}" ]; then
    curl -s -m 10 -o /dev/null -w "%{http_code}" \
      -X "$1" -H "$JSON" -d "$3" "$BASE$2"
  else
    curl -s -m 10 -o /dev/null -w "%{http_code}" \
      -X "$1" "$BASE$2"
  fi
}

# kontrol <aciklama> <beklenen> <gelen>
kontrol() {
  if [ "$2" = "$3" ]; then
    echo "GECTI: $1 ($3)"
  else
    echo "KALDI: $1 (beklenen $2, gelen $3)"
    HATA=1
  fi
}

kontrol "saglik" 200 "$(kod GET /api/healthcheck)"
kontrol "liste" 200 "$(kod GET $KAYIT)"
kontrol "gecersiz id" 400 "$(kod GET $KAYIT/abc)"
kontrol "kotu level" 400 "$(kod POST $KAYIT "$LEVEL")"
kontrol "bos isim" 400 "$(kod POST $KAYIT "$BOS")"

CEVAP=$(curl -s -m 10 -w "\n%{http_code}" -X POST \
  -H "$JSON" -d "$IYI" "$BASE$KAYIT")
KOD=$(echo "$CEVAP" | tail -n 1)
GOVDE=$(echo "$CEVAP" | head -n 1)
kontrol "gecerli kayit" 201 "$KOD"
ID=$(echo "$GOVDE" | sed -n \
  's/.*"insertedId":"\([0-9a-f]*\)".*/\1/p')

if [ -z "$ID" ]; then
  echo "KALDI: kayit id alinamadi"
  exit 1
fi

kontrol "kayit getir" 200 "$(kod GET $KAYIT/$ID)"
kontrol "kotu guncelleme" 400 \
  "$(kod PATCH $KAYIT/$ID "$LEVEL")"
kontrol "kayit sil" 200 "$(kod DELETE $KAYIT/$ID)"
kontrol "silinmis kayit" 404 "$(kod GET $KAYIT/$ID)"
kontrol "saglik (son)" 200 "$(kod GET /api/healthcheck)"

exit $HATA
