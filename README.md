# 2NTECH DevOps Teknik Case

MERN uygulaması (React, Express, MongoDB) ve saat başı çalışan bir Python ETL
işi, yerel bir Kubernetes kümesinde (k3d) çalışır. Dağıtım GitOps ile yapılır
(Argo CD), imajlar GitHub Actions ile derlenir, izleme ve alarm için Prometheus
ve Alertmanager kullanılır.

Case gereksinimleri için `DevOps_Teknik_Case_TR.docx` dosyasına bakın.

## İçindekiler

1. [Dosya yapısı](#dosya-yapısı)
2. [Mimari](#mimari)
3. [Ön koşullar](#ön-koşullar)
4. [Kurulum](#kurulum)
5. [Uygulamaya erişim](#uygulamaya-erişim)
6. [Test](#test)
7. [Deployment ve GitOps](#deployment-ve-gitops)
8. [Rollback](#rollback)
9. [ETL](#etl)
10. [Yedekleme ve geri yükleme](#yedekleme-ve-geri-yükleme)
11. [İzleme ve alarm](#izleme-ve-alarm)
12. [Temizlik](#temizlik)
13. [Sorun giderme](#sorun-giderme)
14. [Bilinen sınırlamalar](#bilinen-sınırlamalar)
15. [Yapay zekâ kullanımı](#yapay-zekâ-kullanımı)

## Dosya yapısı

| Yol | İçerik |
| --- | --- |
| `mern-project/server` | Express backend (`server.mjs`, `routes/`, `db/`) ve Dockerfile |
| `mern-project/client` | React frontend, nginx yapılandırması ve Dockerfile |
| `python-project` | ETL (`ETL.py`), izlenen repo listesi ve Dockerfile |
| `k8s/` | Kubernetes manifestleri (Argo CD bu klasörü izler) |
| `k8s/manual/` | Elle uygulanan manifestler (geri yükleme Job'u, Secret şablonu) |
| `argocd/` | Argo CD uygulama tanımları (`application.yaml`, `monitoring.yaml`) |
| `.github/workflows/ci.yml` | CI hattı |
| `scripts/api-test.sh` | API testleri |
| `docs/` | Bulgular, mimari, yedekleme runbook'u, ekran görüntüleri |

## Mimari

Ayrıntılı diyagram: [docs/architecture.md](docs/architecture.md).

```
Tarayıcı --> :8080 --> k3d yük dengeleyici --> Traefik (ingress)
                                                 |-- /      --> frontend (nginx, 8080) x2
                                                 |-- /api   --> backend (Express, 5050) x2
                                                                   |
                                                                   v
                                                            MongoDB (StatefulSet, PVC)

CronJob github-etl (saat başı) --> GitHub API --> MongoDB (github_etl)
CronJob mongo-backup (günlük)  --> /backup (PVC)

GitHub Actions --> imaj (GHCR) --> manifest etiketi (bot commit) --> Argo CD --> küme
Prometheus + Alertmanager (namespace: monitoring)
```

İstek akışı: kullanıcının tarayıcısı `/` adresinden React sayfasını alır, sayfa
`/api/record` adresine istek atar, ingress bunu backend'e iletir, backend
MongoDB'den okur ya da yazar.

## Ön koşullar

- Docker Desktop (en az 4 GB bellek ayrılmış olmalı)
- [k3d](https://k3d.io), `kubectl`, `git`
- İnternet erişimi (imajlar `ghcr.io/kortangr/devops-case-*` adresinden çekilir,
  paketler herkese açıktır, giriş gerekmez)

Bu repoyu kendi hesabınıza kopyalarsanız (fork), `argocd/application.yaml` ve
`argocd/monitoring.yaml` içindeki `repoURL` ile `k8s/*.yaml` içindeki imaj
adreslerini kendi hesabınıza göre değiştirmeniz gerekir.

## Kurulum

### 1. Kümeyi oluşturun

```bash
k3d cluster create devops-case -p "8080:80@loadbalancer"
kubectl get nodes
```

Bir düğümün `Ready` göründüğünü doğrulayın. `8080:80` eşlemesi, bilgisayarın
8080 portunu kümenin ingress'ine bağlar.

### 2. Namespace ve Secret

```bash
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic app-secret -n devops-case \
  --from-literal=MONGO_INITDB_ROOT_USERNAME=KULLANICI \
  --from-literal=MONGO_INITDB_ROOT_PASSWORD=PAROLA \
  --from-literal=ATLAS_URI="mongodb://KULLANICI:PAROLA@mongo:27017"
```

`KULLANICI` ve `PAROLA` yerine kendi değerlerinizi yazın. Repoda gerçek parola
yoktur, `k8s/manual/secret_example.yaml` yalnızca bir şablondur. Secret,
uygulama pod'ları başlamadan önce oluşturulmalıdır.

### 3. Argo CD'yi kurun

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side \
  -f https://raw.githubusercontent.com/argoproj/argo-cd/v3.5.6/manifests/install.yaml
kubectl get pods -n argocd
```

Tüm pod'lar `Running` olana kadar bekleyin (birkaç dakika sürebilir).

### 4. Uygulamayı ve izlemeyi Argo CD'ye tanıtın

```bash
kubectl apply -f argocd/application.yaml
kubectl apply -f argocd/monitoring.yaml
```

Argo CD `k8s/` klasöründeki manifestleri kümeye uygular (backend, frontend,
MongoDB, servisler, ingress, ETL ve yedek CronJob'ları). Durumu izleyin:

```bash
kubectl get pods -n devops-case
kubectl get pods -n monitoring
```

Beklenen: backend ve frontend ikişer pod, `mongo-0`, hepsi `1/1 Running`.

### 5. Argo CD arayüzü (isteğe bağlı)

```bash
kubectl port-forward svc/argocd-server -n argocd 8090:443
```

Bu komut açık kalmalıdır. Tarayıcıda `https://localhost:8090`. Kullanıcı adı
`admin`, ilk parola:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
```

## Uygulamaya erişim

- Arayüz: `http://localhost:8080`
- API: `http://localhost:8080/api/record`
- Sağlık: `http://localhost:8080/api/healthcheck`

## Test

API testleri (geçersiz id, geçersiz girdi, kayıt oluşturma, silme):

```bash
bash scripts/api-test.sh http://localhost:8080
```

Her satır `GECTI:` ile başlamalıdır. Aynı testler CI'da (`backend-smoke-test`)
her push'ta çalışır.

Arayüzde: `http://localhost:8080/records` adresinden kayıt listesi,
`Create Record` ile yeni kayıt eklenir.

## Deployment ve GitOps

1. `main` dalına push yapılır.
2. GitHub Actions altı işi çalıştırır: `frontend-build`, `backend-build`,
   `backend-smoke-test`, `manifest-validate`, `image-push`, `manifest-update`.
   Herhangi biri başarısız olursa sonraki işler çalışmaz.
3. `image-push` üç imajı (backend, frontend, ETL) kısa commit koduyla
   etiketleyip GHCR'a gönderir.
4. `manifest-update` manifestlerdeki imaj etiketini günceller ve bot olarak
   commit'ler.
5. Argo CD (`automated` + `selfHeal`) değişikliği algılar ve kümeye uygular.

Küme üzerinde elle yapılan değişiklikler (`kubectl edit` gibi) Argo CD
tarafından geri alınır, doğru kaynak Git'tir.

## Rollback

Hatalı bir sürüm dağıtıldığında en güvenli yol, **Git'te geri almaktır**:

```bash
git log --oneline -- k8s/backend-deployment.yaml
git revert <bot commit kodu>
git push
```

Argo CD önceki imaj etiketini otomatik uygular. Alternatif olarak Argo CD
arayüzünde uygulamanın `History and Rollback` ekranından önceki sürüme
dönülebilir (otomatik senkronizasyon açıkken bu geçici olabilir).

Doğrulama:

```bash
kubectl rollout status deployment/backend -n devops-case
kubectl get deploy backend -n devops-case \
  -o jsonpath='{.spec.template.spec.containers[0].image}'
bash scripts/api-test.sh http://localhost:8080
```

`kubectl rollout undo` kullanmayın, `selfHeal` değişikliği geri alır.

## ETL

`python-project/ETL.py`, `izlenen_repolar.json` içindeki 9 reponun son
sürümünü GitHub API'den alır ve MongoDB'ye (`github_etl.repositories`)
yazar. Kayıt anahtarı `_id`: GitHub repo kimliğidir, aynı repo tekrar
işlendiğinde yeni kayıt açılmaz, mevcut kayıt güncellenir. Sabitlenen sürüm
eskiyse loga `WARNING` yazılır. `CronJob github-etl` saat başı çalışır.

Elle çalıştırma ve log:

```bash
kubectl create job --from=cronjob/github-etl etl-elle-1 -n devops-case
kubectl logs job/etl-elle-1 -n devops-case
```

İlk çalışmada `yeni kayit olusturuldu`, sonraki çalışmalarda
`mevcut kayit guncellendi` görülür. Kimlik doğrulaması olmadan GitHub saatte
yaklaşık 60 istek sınırı uygular, çok sık elle çalıştırmayın.

## Yedekleme ve geri yükleme

Ayrıntılı runbook: [docs/backup-restore.md](docs/backup-restore.md).

Yedek, günlük `CronJob mongo-backup` ile `mongodump` kullanılarak alınır,
`/backup` birimine (PVC) yazılır, 7 günden eski dosyalar silinir.

```bash
# elle yedek
kubectl create job --from=cronjob/mongo-backup yedek-elle-1 -n devops-case
kubectl logs job/yedek-elle-1 -n devops-case

# geri yükleme (en yeni yedekten)
kubectl delete job mongo-restore -n devops-case --ignore-not-found
kubectl apply -f k8s/manual/restore-job.yaml
kubectl logs job/mongo-restore -n devops-case
```

## İzleme ve alarm

```bash
kubectl port-forward -n monitoring svc/monitoring-prometheus-server 9090:80
kubectl port-forward -n monitoring svc/monitoring-alertmanager 9093:9093
```

- Prometheus: `http://localhost:9090/alerts`
- Alertmanager: `http://localhost:9093`

Tanımlı alarmlar: `EtlJobBasarisiz` (başarısız ETL Job'u), `BackendHazirDegil`
(hazır olmayan backend kopyası). Backend logları:

```bash
kubectl logs -l app=backend -n devops-case --tail=20
```

## Temizlik

```bash
k3d cluster delete devops-case
docker rmi devops-case-backend:test
```

Küme silindiğinde bütün kaynaklar ve veriler gider.

## Sorun giderme

| Belirti | Olası neden ve çözüm |
| --- | --- |
| Pod `ImagePullBackOff` | GHCR paketi gizli olabilir. Paket ayarlarından `Public` yapın |
| Pod `CreateContainerConfigError` | `app-secret` oluşturulmamış. Kurulum 2. adım |
| `localhost:8080` açılmıyor | Küme `-p "8080:80@loadbalancer"` olmadan kurulmuş olabilir, kümeyi silip yeniden kurun |
| Argo arayüzü açılmıyor | `port-forward` süreci kapanmıştır, yeniden çalıştırın |
| ETL Job `Failed` | `kubectl logs` ile bakın: `Istek siniri doldu` ise GitHub saatlik sınırı, bir sonraki saat başını bekleyin |
| ETL ve yedek çalışmıyor | Bilgisayar uyuyordur, k3d Docker içinde çalıştığı için makine kapalıyken CronJob'lar atlanır |
| Argo `OutOfSync` | `Refresh` düğmesine basın ya da birkaç dakika bekleyin |

## Bilinen sınırlamalar

Bulunan sorunlar, çözümleri ve bilinçli olarak kapsam dışı bırakılan konular:
[docs/findings.md](docs/findings.md). Öne çıkanlar: yedek MongoDB ile aynı
makinede ve şifresiz, alarm bildirim kanalı yok, ortam yerel ve tek düğümlü.

## Yapay zekâ kullanımı

Bu çalışmanın hazırlanması sırasında bir yapay zekâ asistanı (Claude)
açıklama, kod taslağı ve gözden geçirme için kullanılmıştır. Bulguların
yazımı, teknik kararlar ve teslim edilen çalışmanın doğrulaması adaya
aittir. Ayrıntılar mülakatta anlatılabilir.

## Çalışma kanıtları

Ekran görüntüleri ve açıklamaları: [TESLIM_KANITLARI.md](TESLIM_KANITLARI.md).
Case sonu soruları: [CASE_SONU_CEVAPLARI.md](CASE_SONU_CEVAPLARI.md).
