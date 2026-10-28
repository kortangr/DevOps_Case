# TESLİM KANITLARI

Teslimin başarılı şekilde tamamlanmış sayılabilmesi için çalışan sisteme ait ekran görüntülerini `docs/screenshots/` klasörüne ekleyin ve aşağıdaki maddelerde ilgili dosya yolunu belirtin.

Ekran görüntülerinde gerçek credential, token, parola, private key veya hassas bağlantı bilgileri görünmemelidir.

## 1. Web Uygulaması

### 1.1 Ana sayfa

- **Görsel:** `docs/screenshots/uygulama-api-saglikli.png`
- **Açıklama:** Ana sayfada API Status bölümü "API is healthy" yazıyor ve healthcheck cevabını (`message: OK`, `mongo: ok`) gösteriyor. Cevap MongoDB'ye gerçekten ping atılarak üretiliyor.

### 1.2 Create işlemi

- **Form görseli:** `docs/screenshots/create-form.png`
- **Başarılı sonuç görseli:** `docs/screenshots/create-sonuc.png`
- **Açıklama:** Form doldurulup gönderildi (`Test`, `test pos.`, `Junior`). Kayıt Record List'te üçüncü satır olarak göründü.

### 1.3 Edit işlemi

- **İşlem öncesi görsel:** `docs/screenshots/edit-oncesi.png`
- **İşlem sonrası görsel:** `docs/screenshots/edit-sonrasi.png`
- **Açıklama:** Aynı kaydın pozisyonu `test pos.` değerinden `edited pos.` değerine değiştirildi, diğer alanlar aynı kaldı.

## 2. Docker

- **Image build görseli:** `docs/screenshots/docker-build.png`
- **Çalışan container görseli:** `docs/screenshots/docker-ps-calisan-container.png`
- **Ek görsel:** `docs/screenshots/docker-images.png`
- **Açıklama:** Backend imajı yerelde derlendi (`docker-images.png`). Üç imajın (backend, frontend, etl) asıl derlemesi CI'da yapılıp GHCR'ye gönderiliyor (bkz. 5). Uygulama Kubernetes içinde çalıştığı için `docker ps` yalnızca k3d düğümünü ve yük dengeleyicisini gösteriyor, uygulama container'ları düğümün içinde çalışıyor ve 3. maddedeki görüntülerde görülüyor.

## 3. Kubernetes

- **Pod/workload durumu:** `docs/screenshots/kurulum-pod-svc-ingress.png`
- **Service ve varsa Ingress durumu:** `docs/screenshots/kurulum-pod-svc-ingress.png`
- **ETL CronJob/Job durumu:** `docs/screenshots/cronjob-ve-job-listesi.png`
- **Açıklama:** Backend ve frontend ikişer kopya, MongoDB `mongo-0` (StatefulSet) `Running 1/1`. Üç Service ve Traefik ingress tanımlı. `github-etl` her saat başı, `mongo-backup` her gün 02:00'de çalışan CronJob. Elle tetiklenen işler (`etl-elle-2`, `yedek-elle-1`, `yedek-elle-2`, `mongo-restore`) `Complete 1/1`.

## 4. Python ETL

### 4.1 İlk veri aktarımı

GitHub repository bilgilerinin MongoDB’ye ilk kez kaydedildiğini gösterin.

- **Görsel veya terminal çıktısı:** `docs/screenshots/etl-ilk-calisma-yeni-kayit.png`
- **Açıklama:** CronJob'un oluşturduğu ilk çalışmada 9 repository için de "yeni kayit olusturuldu" yazıyor. Özet: `Basarili: 9, basarisiz: 0`, koleksiyonda toplam 9 kayıt.

### 4.2 Aynı repository için güncelleme

Aynı repository tekrar işlendiğinde duplicate kayıt oluşmadığını ve mevcut kaydın güncellendiğini gösterin. Mümkünse repository sayısını ve güncellenen alanı aynı kanıt içinde belirtin.

- **Görsel veya terminal çıktısı:** `docs/screenshots/etl-ikinci-calisma-guncelleme.png`
- **Kullanılan benzersiz alan:** `_id` (GitHub'ın repository için verdiği sayısal `id`)
- **Açıklama:** `etl-elle-2` işiyle ETL ikinci kez çalıştırıldı. 9 repository için de "mevcut kayit guncellendi" yazıyor ve koleksiyondaki toplam kayıt 9 olarak kaldı, yani çift kayıt oluşmadı. Kayıt, `_id` üzerinden upsert ile yazıldığı için her çalışmada `etl_son_calisma` alanı güncelleniyor, `etl_ilk_kayit` ilk yazımdaki değerini koruyor.

## 5. CI/CD

- **Başarılı pipeline görseli:** `docs/screenshots/ci-pipeline-yesil.png`
- **Build/image/deployment aşamalarını gösteren görsel:** `docs/screenshots/ci-pipeline-yesil.png`, `docs/screenshots/argocd-uygulamalar-synced-healthy.png`
- **Ek görsel:** `docs/screenshots/ci-api-testleri.png`
- **Açıklama:** Pipeline: `frontend-build`, `backend-build`, `manifest-validate`, `backend-smoke-test` (API testleri), üç imaj için `image-push` ve en sonda `manifest-update`. `manifest-update` yeni imaj etiketini `k8s/` dosyalarına yazıp commit ediyor, Argo CD bu değişikliği alıp kümeye uyguluyor. Argo CD'de her iki uygulama da `Healthy` ve `Synced`.

## 6. Backup ve Restore

Aşağıdaki altı adımın tamamı kanıtlanmalıdır. Adımların aynı kayıt üzerinde ve sırayla yapıldığı anlaşılmalıdır.

Senaryo `sample_training.records` koleksiyonu üzerinde, iki kayıtla (Kortan ve Utku) yapıldı. Yedek 27 Ekim 22:14'te (UTC) alındı, koleksiyon silme ve geri yükleme ertesi sabah yapıldı (geri yükleme günlüğü 28 Ekim 06:08 UTC).

### 6.1 Kayıt oluşturma

- **Görsel:** `docs/screenshots/geri-yukleme-1-onceki-kayitlar.png`
- **Veritabanı çıktısı:** `docs/screenshots/db-sayim-oncesi-2-kayit.png`
- **Açıklama:** Arayüzde iki kayıt var, veritabanında `countDocuments()` sonucu 2.

### 6.2 Yedek alma

- **Görsel veya terminal çıktısı:** `docs/screenshots/geri-yukleme-2-yedek-logu.png`
- **Kullanılan yöntem ve komut:** `mongodump` ile sıkıştırılmış arşiv. CronJob'dan elle iş üretildi: `kubectl create job --from=cronjob/mongo-backup yedek-elle-2 -n devops-case`
- **Yedeğin saklandığı konum:** `backup-pvc` (2Gi PVC) içinde `/backup/mongo-20261027-221403.gz`. Dosya listesi: `docs/screenshots/yedek-dosyalari-pvc.png`
- **Açıklama:** Log'da `sample_training.records` için 2 belge yedeklendi (`github_etl.repositories` için 9 belge). Yedek, kümenin içinde ve MongoDB ile aynı düğümde duruyor, bu sınırlama `docs/findings.md` içinde belirtildi.

### 6.3 Collection veya veritabanının silinmesi

- **Görsel veya terminal çıktısı:** `docs/screenshots/db-collection-silindi-sayim-0.png`
- **Açıklama:** `sample_training.records` koleksiyonu `drop()` ile tamamen silindi, komut `true` döndürdü.

### 6.4 Verinin kaybolduğunun gösterilmesi

- **Arayüz görseli:** `docs/screenshots/arayuz-liste-bos.png`
- **Veritabanı çıktısı:** `docs/screenshots/db-collection-silindi-sayim-0.png`
- **Açıklama:** Silmeden sonra `countDocuments()` sonucu 0, arayüzde Record List boş.

### 6.5 Yedekten geri yükleme

- **Görsel veya terminal çıktısı:** `docs/screenshots/geri-yukleme-logu-ve-sure.png`
- **Ölçülen geri yükleme süresi:** 5 saniye (`kubectl get job mongo-restore`, `DURATION 5s`; pod'un başlaması dahil)
- **Açıklama:** `k8s/manual/restore-job.yaml` ile `mongorestore` işi çalıştırıldı, en yeni yedekten (`mongo-20261027-221403.gz`) `sample_training.records` yeniden oluşturuldu. Log: `2 document(s) restored successfully. 0 document(s) failed to restore.`

### 6.6 Verinin geri geldiğinin doğrulanması

- **Arayüz görseli:** `docs/screenshots/arayuz-kayitlar-geri-geldi.png`
- **Veritabanı çıktısı:** `docs/screenshots/db-sayim-sonrasi-2-kayit.png`
- **Açıklama:** Geri yüklemeden sonra `countDocuments()` sonucu 2, arayüzde Kortan ve Utku kayıtları yeniden listeleniyor.

> Runbook, RPO/RTO hedefleri ve retention süresi `docs/backup-restore.md` içinde dokümante edilmelidir.

## 7. Logging, Monitoring ve Üst Kriterler

Uyguladığınız logging, monitoring, alarm, Helm, Terraform, güvenlik taraması veya diğer üst kriterlere ait kanıtları ekleyin.

- **Backend log formatı:** `docs/screenshots/backend-log-formati.png`
  - Her satırda zaman damgası, seviye (`INFO`) ve istek başına bir satır (yöntem, yol, durum kodu, süre).
- **ETL gerçek hata logu (rate limit):** `docs/screenshots/etl-rate-limit-logu.png`
  - GitHub istek sınırı dolduğunda nedeni ve sıfırlanma saatini açıkça yazıyor.
- **Başarısız ETL işleri:** `docs/screenshots/etl-basarisiz-jobs.png`
- **Prometheus alarm kuralları (ETL alarmı tetiklenmiş):** `docs/screenshots/prometheus-alarm-firing.png`
- **Alertmanager'da alarm:** `docs/screenshots/alertmanager-alarm.png`
- **Backend alarmı tetiklenmiş:** `docs/screenshots/ariza-alarm-backend-hazir-degil.png`
- **Açıklama:** İki alarm kuralı tanımlı: `EtlJobBasarisiz` (başarısız ETL Job'u) ve `BackendHazirDegil` (2 dakikadan uzun süre hazır olmayan backend). `EtlJobBasarisiz`, gerçek bir ETL hatasında (GitHub rate limit) tetiklendi. `BackendHazirDegil`, MongoDB bilerek durdurularak tetiklendi (bkz. 8). Alertmanager alarmı gösteriyor ama bildirim kanalı (e-posta, Slack) bağlı değil, bu `docs/findings.md` içinde kapsam dışı olarak yazıldı.

## 8. Ek Kanıtlar

- **Container'lar yetkisiz kullanıcıyla çalışıyor:** `docs/screenshots/guvenlik-non-root-kimlik.png`
  - Backend `uid=1000`, frontend `uid=101`, MongoDB `uid=999`, hiçbiri root değil.
- **Arıza testi, MongoDB durduruldu:** `docs/screenshots/ariza-mongo-durdu-backend-hazir-degil.png`
  - `mongo-0` yok, iki backend pod'u `0/1` (hazır değil).
- **Arıza testi, arayüzde etkisi:** `docs/screenshots/ariza-api-ulasilamaz.png`
  - Hazır olmayan backend'lere istek yönlenmediği için sayfa "API is unreachable" gösteriyor.
- **Argo CD'de bozulmuş durum:** `docs/screenshots/argocd-degraded.png`
- **Sıfırdan kurulum:** `docs/screenshots/kurulum-node-hazir.png`, `docs/screenshots/kurulum-argocd-podlar.png`
  - Küme silinip README adımlarıyla yeniden kuruldu, düğüm hazır ve Argo CD pod'ları çalışıyor.
- **Açıklama:** Arıza testi sırasında Argo CD'nin otomatik eşitlemesi geçici olarak kapatıldı (aksi hâlde MongoDB'yi geri açardı), test sonunda yeniden açıldı.
