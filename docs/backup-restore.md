# Backup & Restore Runbook

Kanıt ekran görüntüleri [TESLIM_KANITLARI.md](../TESLIM_KANITLARI.md) dosyasının 6. bölümünden referanslanır.

---

## 1. Yaklaşım / Approach

| | |
| --- | --- |
| Yedekleme yöntemi / Backup method | `mongodump --gzip --archive` (mantıksal yedek, tek sıkıştırılmış dosya) |
| Nasıl çalıştırılıyor / Execution method | Günlük `CronJob mongo-backup` (`k8s/backup-cronjob.yaml`). Elle: `kubectl create job --from=cronjob/mongo-backup <ad> -n devops-case` |
| Yedeğin saklandığı konum / Backup storage location | `backup-pvc` (2Gi PVC, `local-path`), dosya yolu `/backup/mongo-YYYYMMDD-HHMMSS.gz`. MongoDB ile aynı kümede ve aynı düğümde |
| Yedek formatı ve boyutu / Backup format and size | gzip arşivi, yedek başına tek dosya. Ölçülen: yaklaşık 2 KB (`mongo-20261027-221403.gz`, 2.3K), veri çok küçük |
| Sıklık / Frequency | Günde bir kez, 02:00 (CronJob'da zaman dilimi tanımlı değil, küme saatine göre) |
| Retention süresi / Retention period | 7 gün. Her yedekten sonra `find /backup -name 'mongo-*.gz' -mtime +7 -delete` ile eski dosyalar silinir |
| Şifreleme ve erişim kontrolü / Encryption and access control | Yedek dosyaları şifrelenmemiştir. Disk yalnızca yedek ve geri yükleme pod'larına bağlanır, geri yüklemede salt okunur. Pod'lar root olmayan kullanıcıyla (999) çalışır, MongoDB kimlik bilgileri `app-secret` Secret'ından okunur |

## 2. Hedefler / Targets

| | Hedef / Target | Ölçülen / Measured |
| --- | --- | --- |
| RPO | 24 saat | 24 saat. Yedek günde bir kez alındığı için en kötü durumda son yedekten bu yana geçen süre kadar veri kaybolur. Hesaplanan değerdir, ölçüm değildir |
| RTO | 15 dakika | Geri yükleme adımı 5 saniye (`kubectl get job mongo-restore`, `DURATION 5s`, pod'un başlaması dahil). Sorunu fark etme, komutları çalıştırma ve arayüzde doğrulama süresi dahil değildir, ölçülmedi |

## 3. Yedek alma adımları / Backup procedure

Otomatik yedek her gün 02:00'de `mongo-backup` CronJob'u ile alınır. Elle yedek almak için:

```bash
kubectl create job --from=cronjob/mongo-backup yedek-elle-1 -n devops-case
kubectl logs job/yedek-elle-1 -n devops-case
kubectl get job yedek-elle-1 -n devops-case
```

İş şunları yapar: `mongodump` ile arşivi `/backup` altına yazar, `gzip -t` ile arşivin bozuk olmadığını sınar, 7 günden eski yedekleri siler. Adımlardan biri hata verirse (`set -e`) iş başarısız olur.

## 4. Geri yükleme adımları / Restore procedure

```bash
kubectl delete job mongo-restore -n devops-case --ignore-not-found
kubectl apply -f k8s/manual/restore-job.yaml
kubectl logs job/mongo-restore -n devops-case
kubectl get job mongo-restore -n devops-case
```

Dikkat edilecekler:

- İş her zaman **en yeni** yedeği kullanır (`ls -t /backup/*.gz | head -1`). Daha eski bir yedek gerekiyorsa `k8s/manual/restore-job.yaml` içindeki bu ifade o dosyanın adıyla değiştirilmelidir.
- Yalnızca uygulama veritabanını (`sample_training`) geri yükler. ETL'in `github_etl` veritabanı yedeğe girer ama geri yüklenmez, ETL bir sonraki çalışmada bu veriyi GitHub'dan yeniden üretir.
- `--drop` kullanıldığı için mevcut koleksiyon önce silinir. Yedekten sonra eklenen kayıtlar kaybolur.
- Dosya `k8s/manual/` altındadır, Argo CD tarafından yönetilmez, elle uygulanır.

## 5. Doğrulama / Verification

- **Yedek bozuk mu:** her yedeğin ardından `gzip -t` arşivi sınar. Arşiv bozuksa iş başarısız olur ve `failedJobsHistoryLimit` ile görünür kalır.
- **Yedek eksik mi:** `mongodump` log'u hangi koleksiyondan kaç belge yazıldığını gösterir (örneğin `sample_training.records` 2 belge).
- **Geri yükleme çalışıyor mu:** yedek, düzenli bir otomatik geri yükleme testiyle sınanmıyor. Geri yükleme elle, aşağıdaki uçtan uca senaryoyla denendi: veri silindi, yedekten geri yüklendi, kayıt sayısı ve arayüz doğrulandı.

## 6. Uçtan uca test sonucu / End-to-end test result

Senaryo `sample_training.records` koleksiyonunda, iki kayıtla (Kortan ve Utku) yapıldı. Yedek 27 Ekim 2026 22:14'te (UTC) alındı. Koleksiyon silme ve geri yükleme 28 Ekim 2026 sabahı yapıldı (geri yükleme günlüğü 06:08 UTC).

| # | Adım / Step | Sonuç / Result | Kanıt / Evidence |
| --- | --- | --- | --- |
| 1 | Kayıt oluşturuldu / Record created | Arayüzde 2 kayıt, veritabanında `countDocuments()` = 2 | `geri-yukleme-1-onceki-kayitlar.png`, `db-sayim-oncesi-2-kayit.png` |
| 2 | Yedek alındı / Backup taken | `mongo-20261027-221403.gz`, `sample_training.records` 2 belge | `geri-yukleme-2-yedek-logu.png`, `yedek-dosyalari-pvc.png` |
| 3 | Collection/DB silindi / Collection or DB dropped | `records.drop()` sonucu `true` | `db-collection-silindi-sayim-0.png` |
| 4 | Verinin kaybolduğu görüldü / Data confirmed gone | `countDocuments()` = 0, arayüzde liste boş | `db-collection-silindi-sayim-0.png`, `arayuz-liste-bos.png` |
| 5 | Yedekten geri yüklendi / Restored from backup | `2 document(s) restored successfully. 0 document(s) failed`, iş süresi 5 saniye | `geri-yukleme-logu-ve-sure.png` |
| 6 | Veri geri geldi / Data confirmed back | `countDocuments()` = 2, arayüzde Kortan ve Utku kayıtları | `db-sayim-sonrasi-2-kayit.png`, `arayuz-kayitlar-geri-geldi.png` |

Görüntüler `docs/screenshots/` klasöründedir.

## 7. Bilinen sınırlamalar / Known limitations

- **Yedek aynı kümede ve aynı düğümde.** Düğüm ya da disk kaybolursa MongoDB verisi ile yedek birlikte kaybolur. Productionda yedek, kümenin dışında bir nesne depolamasına (örneğin bir bulut deposu) kopyalanmalı.
- **Yedek şifrelenmiyor.** Productionda yedek şifrelenmeli, depoya erişim kısıtlanmalı.
- **RPO 24 saat.** Yedek günde bir alınır. Daha düşük RPO için yedek sıklığı artırılabilir ya da MongoDB replica set ve oplog ile belirli bir ana geri dönüş (point-in-time recovery) kurulabilir.
- **Yerel ortamda bilgisayar uykudayken CronJob çalışmaz.** Yedek zamanında bilgisayar uykudaysa o günün yedeği alınmaz (bkz. [findings.md](findings.md)). Yönetilen bir Kubernetes servisinde bu sorun olmaz.
- **Geri yükleme elle yapılıyor** ve otomatik olarak sınanmıyor. Productionda düzenli bir geri yükleme testi çalıştırılmalı.
- **Yalnızca `sample_training` geri yüklenir.** ETL verisi yedeklenir ama geri yüklenmez, ETL'in yeniden çalışmasıyla oluşur.
