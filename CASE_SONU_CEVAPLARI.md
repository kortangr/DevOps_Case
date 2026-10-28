# CASE SONU CEVAPLARI

Bu dosyada aşağıdaki soruların tamamını, yaptığınız çalışma ile doğrudan ilişkilendirerek cevaplayın.

Cevaplarınızın kısa, somut ve teknik kararlarınızı açıklayacak düzeyde olması beklenmektedir. Gerekli gördüğünüz yerlerde ilgili kaynak koduna, manifest dosyasına, pipeline adımına veya dokümana dosya yolu vererek referans verebilirsiniz. Çalışma kanıtları ve ekran görüntüleri ayrıca `TESLIM_KANITLARI.md` dosyasında sunulmalıdır.

---

## Aday Bilgileri

- **Ad Soyad: Kortan Utku Giritlioğlu**
- **Repository adresi: https://github.com/kortangr/DevOps_Case**
- **Çalışmanın tamamlandığı tarih: 28/10/2026**
- **Kullanılan hedef ortam: Yerel Kubernetes**

---

## 1. Mimari ve İstek Akışı

Kurduğunuz mimariyi ve bir kullanıcı isteğinin frontend’den başlayarak backend ve veritabanına kadar izlediği yolu açıklayın.

Ayrıca sistem bileşenlerini, bileşenler arasındaki bağlantıları, trafik akışını ve dış erişim noktalarını gösteren bir mimari diyagram hazırlayarak proje reposuna aşağıdaki dosyalardan biri olarak ekleyin:

- `docs/architecture.md`
- `docs/architecture.pdf`

Diyagram Mermaid, Draw.io, Excalidraw veya benzeri bir araçla hazırlanabilir. Düzenlenebilir kaynak dosyasının da repoya eklenmesi beklenmektedir.

**Cevap: Tarayıcıdan gelen http istekleri önce Ingress'e giderler. Ingress burda isteğin formatına göre sıralama yapar. Örneğin "/" ile başlaya istekler frontend'e gönderilir. Frontend bu isteği alır ve gerekli arayüz kodlarını tarayıcıya gönderir. Arayüz kodu yine Ingress'e "/api" ile başlayan ve yapacağımız işleme göre değişen(GET,POST,DELETE,PATCH) bir adrese istek göndermek istediğini aktarır ve bu sefer "/api/" ile başlayan bir adrese gidecek bir istek olduğu için Ingress bu isteği backend'e yönlendirir. Backend isteği alır ve MongoDbye sorar. MongoDb kayıtlarda yapılacak işlemi yapar ve aynı yoldan geri döndürür.**

---

## 2. Kritik Bulgular ve Önceliklendirme

Başlangıç projelerinde tespit ettiğiniz en kritik üç sorun neydi? Bu sorunları hangi etki ve risk kriterlerine göre önceliklendirdiniz?

**Cevap:** En kritik üç sorun (ayrıntılar `docs/findings.md` 1-3. maddeler):

1. **Healthcheck yanıltıcıydı.** `healthcheck.mjs` MongoDB'ye bakmadan her zaman "OK" dönüyordu. MongoDB çökse bile pod'lar sağlıklı görünüyor, istekler boşa gidiyordu. Artık MongoDB'ye 2 saniyelik zaman aşımıyla ping atıyor, cevap gelmezse 503 dönüyor ve bu cevap readiness probe'a bağlı.
2. **Geçersiz kimlik backend'i çökertiyordu.** `/api/record/aaaaa` gibi tek bir istek, hatası yakalanmadığı için Node sürecini kapatıyordu. Kimlik biçimi artık doğrulanıyor, geçersizse 400 dönüyor (`mern-project/server/routes/record.mjs`).
3. **Probe ve kaynak sınırı yoktu.** Kubernetes takılan bir pod'u fark edemiyor, bellek sızıntısı makineyi yorabiliyordu. Backend, frontend ve MongoDB'ye readiness/liveness probe ve CPU/bellek istek ve limitleri eklendi.

Önceliklendirme kriterlerim: **etki** (tüm kullanıcıları ve veriyi etkiliyor mu), **tetiklenme kolaylığı** (kimlik doğrulaması olmadan tek bir istekle ya da kendiliğinden oluşabiliyor mu) ve **fark edilebilirlik** (sorun çıkınca görülebiliyor mu). Healthcheck sorunu en sinsi olanıydı, çünkü sistem sorun varken "sağlıklı" görünüyordu. Üçü de findings'te "Yüksek". Girdi doğrulaması, bağlantı hatası yönetimi, durum kodları, root çalışma ve loglama "Orta" ve "Düşük" olarak sıralandı.

---

## 3. Kapsam Dışında Bırakılan Konular

Hangi sorunları bilinçli olarak düzeltmediniz veya kapsam dışında bıraktınız? Bu kararların gerekçelerini açıklayın.

**Cevap:** Ayrıntılar `docs/findings.md` "Kapsam Dışı Bırakılanlar" bölümünde. Ortak gerekçe: ortam yerel ve tek düğümlü, süre sınırlı ve önceliği zorunlu gereksinimlere verdim.

- **Yedek aynı kümede ve şifresiz.** Düğüm ya da disk giderse yedek de gider. Dışarıda bir yedek ortamı kurmadım. Productionda şifreli, erişimi kısıtlı bir bulut depolamasına kopyalardım.
- **Alarmların bildirim kanalı yok.** Alertmanager alarmı kendi arayüzünde gösteriyor, e-posta ya da Slack'e göndermiyor. Productionda bir bildirim kanalına bağlardım.
- **Bilgisayar uykudayken CronJob çalışmaz.** k3d Mac'imde çalıştığı için saatlik ETL ve günlük yedek uyku sırasında atlanıyor. Productionda yönetilen Kubernetes ya da çok düğümlü bir küme kullanırdım.
- **Cypress testini CI'a bağlamadım.** Temel doğrulamayı `scripts/api-test.sh` API testleriyle sağladım. Productionda Cypress benzeri bir arayüz testi eklerdim.
- **arm64 imaj derlemesi QEMU ile yapılıyor** ve pipeline'ı yavaşlatıyor. Çalışmayı etkilemiyor, yalnızca yayına çıkışı geciktiriyor. Productionda gerçek arm64 runner kullanırdım.
- **Yük testi yapmadım, Prometheus verisi kalıcı değil** (saklama süresi 6 saat), **başarısız bir ETL Job'unun alarmı Job silinene kadar sönmüyor.** `server.mjs` hâlâ `dotenv` yükleyen bir modülü içe aktarıyor, ortam değişkenleri Kubernetes'ten geldiği için zararsız, temizlenmedi.

---

## 4. Hedef Ortam Seçimi

Cloud veya sanal makine tercihinin gerekçesi nedir? Gerçek bir production ortamında mevcut çözümden farklı olarak hangi bileşenleri veya yaklaşımları kullanırdınız?

**Cevap:** Yerel **k3d** kullandım (Docker içinde çalışan k3s, tek düğüm). Bulut denedim ama ilerleyemedim: Azure for Students öğrenci doğrulamasını kabul etmedi, Oracle Cloud kredi kartı istedi. Linux VM üzerinde k3s ile k3d arasında vaka açısından bir fark görmedim, VM'in RAM'imi daha çok zorlayacağını düşündüm. k3d'nin avantajı, kümeyi silip README adımlarıyla sıfırdan kurmanın hızlı olması. Bunu gerçekten yaptım: kümeyi sildim, README'yi izleyerek yeniden kurdum ve kanıtları o kurulumdan aldım.

Productionda şunları farklı yapardım:
- Çok düğümlü yönetilen Kubernetes (EKS, GKE, AKS).
- MongoDB için replica set (en az 3 kopya) ya da yönetilen bir veritabanı hizmeti.
- Yedeği kümenin dışında, şifreli bir nesne depolamasında tutmak.
- HTTPS (TLS sertifikası) ve küme içi trafik için NetworkPolicy.
- Secret'lar için harici bir secret yönetimi (Vault, External Secrets).
- Alarm bildirim kanalı, dashboard (Grafana), merkezi log toplama ve kalıcı metrik depolama.
- Otomatik ölçekleme (HPA), imaj zafiyet taraması ve düzenli otomatik geri yükleme testi.

---

## 5. MongoDB Yaklaşımı

MongoDB için kullandığınız deployment ve servis yaklaşımını neden seçtiniz? Değerlendirdiğiniz alternatifleri, avantajları, dezavantajları ve operasyonel trade-off’ları açıklayın.

**Cevap:** MongoDB'yi kümenin içinde **StatefulSet** (tek kopya), `volumeClaimTemplates` ile 1Gi kalıcı disk (`data-mongo-0`) ve **headless Service** ile çalıştırdım (`k8s/mongo-statefulset.yaml`, `k8s/mongo-service.yaml`). StatefulSet'i seçtim çünkü MongoDB durum tutuyor: pod yeniden başlasa da kimliği (`mongo-0`) ve diski aynı kalıyor, veri kaybolmuyor. Headless Service, pod'a sabit bir DNS adı veriyor, backend `mongo` adıyla bağlanıyor.

Değerlendirdiğim alternatifler:
- **MongoDB Atlas (yönetilen):** bakım, yedek ve yüksek erişilebilirliği hazır sunar. Eledim: dış bir servise ve hesaba bağımlılık getiriyor, bağlantı bilgisi kümenin dışına çıkıyor, ben de kümenin içinde çözüm istedim.
- **Deployment + PVC:** daha basit görünüyor ama pod kimliği ve diske sıralı bağlanma garantisi yok, durum tutan bir uygulama için yanlış araç.
- **Replica set (3 kopya):** yüksek erişilebilirlik sağlar. Tek düğümlü yerel kümede gerçek bir fayda getirmez (üç kopya aynı makinede) ve işletme karmaşıklığı artar.

Trade-off: tek kopya kurulumu basit ve yönetimi kolay, ama **tek hata noktası.** MongoDB pod'u yeniden başlarken hizmet kesilir. Production için replica set (ya da yönetilen servis) gerekir.

---

## 6. Helm veya Manifest Yönetimi

Çözümünüzde Helm kullandıysanız neden tercih ettiğinizi ve Helm’in bu projede hangi problemi çözdüğünü açıklayın.

Düz Kubernetes manifestleri veya Kustomize gibi alternatiflerle karşılaştırıldığında sağladığı avantajları ve oluşturduğu ek karmaşıklığı belirtin.

Helm kullanmadıysanız tercih ettiğiniz yöntemi ve seçim gerekçenizi açıklayın.

**Cevap:** Uygulamanın kendisi için Helm kullanmadım, **düz Kubernetes manifestleri** kullandım (`k8s/` klasörü) ve Argo CD ile uyguluyorum. Gerekçe: proje küçük (üç imaj, tek ortam), farklı ortamlar için değer değiştirmem gerekmiyor, düz YAML okunması ve hata ayıklaması kolay ve CI'da `kubeconform` ile doğrudan doğrulanabiliyor (`manifest-validate`). Helm'in şablon katmanı bu projede çözecek bir problem bulmadan karmaşıklık eklerdi.

Helm'i yalnızca hazır bir paket için kullandım: **Prometheus'u** resmi helm chart'ı (sürüm 29.38.2) ile, ayrı bir Argo CD uygulaması olarak kurdum (`argocd/monitoring.yaml`, ayarlar `valuesObject` içinde). Prometheus gibi çok parçalı hazır bir yazılımı kendi manifestlerimle yazmak yerine chart kullanmak mantıklıydı.

Helm'in sağlayacağı avantajlar (çok ortam için parametre, sürüm yönetimi, paketleme) ve Kustomize'ın (üst üste yama) bu projede gereği yoktu. Ortam sayısı artarsa Kustomize ya da Helm'e geçerdim.

---

## 7. Kubernetes Service Tipleri

Kubernetes Service tiplerini hangi kriterlere göre belirlediniz?

Her servis için neden `ClusterIP`, `NodePort`, `LoadBalancer`, `ExternalName` veya headless Service tercih ettiğinizi açıklayın. Hangi servislerin cluster dışından erişilebilir olması gerektiğini ve gereksiz dış erişimi nasıl engellediğinizi belirtin.

**Cevap:** Kriterim: yalnızca kullanıcıya hizmet veren tek nokta dışarıya açık olsun, geri kalan her şey küme içinde kalsın.

- **frontend:** `ClusterIP`, port 8080. Dışarıdan doğrudan değil, Ingress üzerinden erişilir.
- **backend:** `ClusterIP`, port 5050. Yalnızca Ingress (`/api`) ve küme içi bileşenler erişir.
- **mongo:** **headless** (`clusterIP: None`), port 27017. StatefulSet için gerekli (pod'a sabit DNS adı), yalnızca küme içinden erişilir.

`NodePort`, `LoadBalancer` ve `ExternalName` kullanmadım, çünkü hiçbir uygulama bileşenini doğrudan dışarı açmak gerekmiyordu. Dışarıya açılan tek nokta **Ingress (Traefik)**: k3d yük dengeleyicisi 8080 portunu Ingress'e bağlıyor (`localhost:8080`). Argo CD, Prometheus ve Alertmanager arayüzlerine yalnızca ihtiyaç anında `kubectl port-forward` ile erişiliyor, kalıcı olarak açık değil.

Sınırlama: küme içinde NetworkPolicy tanımlamadım, yani küme içindeki herhangi bir pod MongoDB'ye ulaşabilir. Productionda NetworkPolicy ile yalnızca backend, yedek ve ETL'in MongoDB'ye erişmesine izin verirdim.

---

## 8. Kubernetes Workload Türleri

Uygulama bileşenleri için kullandığınız iş yükü (workload) türlerini hangi kriterlere göre seçtiniz?

Frontend, backend, MongoDB ve ETL bileşenlerinde neden `Deployment`, `StatefulSet`, `Job`, `CronJob` veya farklı bir workload türü kullandığınızı açıklayın.

Karar verirken aşağıdaki konuları nasıl değerlendirdiğinizi belirtin:

- Stateless veya stateful çalışma modeli
- Kalıcı depolama ihtiyacı
- Pod kimliği ve sıralı çalışma gereksinimi
- Çalışma sıklığı
- Yeniden başlatma davranışı
- Ölçeklenebilirlik ihtiyacı

**Cevap:**

| Bileşen | Workload | Gerekçe |
| --- | --- | --- |
| frontend | `Deployment`, 2 kopya | Stateless, disk gerektirmez, pod kimliği önemsiz. Biri düşerse yenisi açılır, kopya sayısıyla kolayca ölçeklenir |
| backend | `Deployment`, 2 kopya | Stateless (durum MongoDB'de), kopyalar birbirinin yerine geçebilir. Rolling update ile kesintisiz güncellenir |
| MongoDB | `StatefulSet`, 1 kopya | Stateful. Kalıcı disk (PVC) ve sabit pod kimliği (`mongo-0`) gerekir. Yeniden başladığında aynı diske bağlanır |
| ETL | `CronJob` (saat başı) | Periyodik, çalışıp biten bir iş. `restartPolicy: Never`, `backoffLimit: 1`, `activeDeadlineSeconds: 300`, `concurrencyPolicy: Forbid` ile takılırsa 5 dakikada sonlandırılır, üst üste binmez |
| Yedek | `CronJob` (günlük 02:00) | Periyodik iş, `backoffLimit: 2`, `concurrencyPolicy: Forbid`, diske yazar (`backup-pvc`) |
| Geri yükleme | `Job` (elle) | Tek seferlik, yalnızca ihtiyaç olunca çalıştırılır, bu yüzden `k8s/manual/` altında ve Argo dışında |

Yeniden başlatma davranışı: Deployment ve StatefulSet pod'ları çöküp kapanırsa Kubernetes yeniden başlatır (readiness ve liveness probe'larıyla). Job ve CronJob pod'ları işi bitince bilerek yeniden başlamaz. Ölçeklenebilirlik: yalnızca stateless Deployment'lar kopya sayısıyla ölçeklenir, MongoDB tek kopya olduğu için şimdilik ölçeklenmez.

---

## 9. Konfigürasyon ve Secret Yönetimi

Uygulama konfigürasyonlarını ve secret bilgilerini nasıl yönettiniz?

Bir secret değeri değiştirildiğinde veya yenilendiğinde uygulamanın yeni değeri güvenli şekilde kullanmasını nasıl sağlarsınız?

**Cevap:** Gizli bilgiler (MongoDB kullanıcı adı, parolası ve bağlantı adresi `ATLAS_URI`) tek bir Kubernetes **Secret**'ında (`app-secret`) tutuluyor. Bu Secret **repoda yok**, README'deki komutla elle oluşturuluyor. Repoda yalnızca yer tutuculu bir şablon var (`k8s/manual/secret_example.yaml`). Pod'lar değerleri `secretKeyRef` ile ortam değişkeni olarak alıyor (backend, ETL, yedek, geri yükleme). Gizli olmayan ayarlar için ayrı ConfigMap kullanmadım, ayarlar kodda varsayılan değerlerle ya da manifestin içinde.

Secret değiştiğinde: ortam değişkenleri pod **başlarken** okunur, Secret'ı değiştirmek çalışan pod'u etkilemez. Backend'in yeni değeri alması için `kubectl rollout restart deploy/backend -n devops-case` ile kopyalar yenilenir (rolling update, kesinti olmaz). Bunu gerçekten yaşadım: Secret'taki `ATLAS_URI` düzeltilince backend'leri bu komutla yeniden başlatmam gerekti.

Dikkat edilmesi gereken bir nokta: MongoDB kullanıcı ve parolası yalnızca ilk açılışta oluşturulur. Parolayı yenilemek için yalnızca Secret'ı değiştirmek yetmez, MongoDB içinde kullanıcının parolasını da değiştirmek gerekir, sonra Secret güncellenip uygulamalar yeniden başlatılır. Productionda Secret'ları harici bir yönetim aracından (Vault, External Secrets) çeker, düzenli yenileme için süreç tanımlardım.

---

## 10. MongoDB Erişim Problemi

MongoDB erişilemez hale gelirse backend uygulaması, readiness/liveness kontrolleri ve kullanıcı istekleri nasıl davranır?

Kullanıcı etkisini azaltmak ve servisin kontrollü şekilde toparlanmasını sağlamak için hangi önlemleri aldınız veya alırdınız?

**Cevap:** Bunu gerçek bir arıza testiyle denedim (MongoDB'yi durdurdum, `TESLIM_KANITLARI.md` bölüm 8).

- **Readiness probe** `/api/healthcheck` adresine bakar. Bu uç MongoDB'ye 2 saniye zaman aşımıyla ping atar, cevap gelmezse 503 döner. Birkaç başarısız denemeden sonra pod "hazır değil" olur ve Service'in uç noktalarından çıkarılır, yani istekler bozuk pod'a gitmez. MongoDB geri gelince probe kendiliğinden geçer ve pod'lar yeniden trafiğe girer.
- **Liveness probe** bilerek yalnızca porta bakıyor (`tcpSocket`). MongoDB çökünce backend'i yeniden başlatmak sorunu çözmez, yalnızca gereksiz yeniden başlatma döngüsü yaratırdı. Testte backend pod'ları yeniden başlamadan `0/1` olarak kaldı.
- **Kullanıcı etkisi:** iki backend de hazır değilken istek cevap alamaz, arayüz "API is unreachable" gösterir. Veri kaybı olmaz, MongoDB'nin diski yerinde kalır.
- **Başlangıçta** MongoDB'ye bağlanamazsa backend kendini kapatır (`conn.mjs`, `process.exit(1)`) ve Kubernetes yeniden başlatır. Bu davranışı sıfırdan kurulumda gördüm: Secret'taki bağlantı adresi yanlış olduğu için backend `Authentication failed` hatasıyla CrashLoopBackOff'a girdi, Secret düzeltilip backend yeniden başlatılınca düzeldi.
- **Alarm:** `BackendHazirDegil` hazır olmayan backend 2 dakika sürerse tetiklenir.

Productionda ek olarak: MongoDB replica set ile otomatik yük devretme, backend'de bağlantı yeniden deneme ve istek zaman aşımları, kullanıcıya anlaşılır bir hata mesajı (503 ve açıklama), PodDisruptionBudget ve alarm bildirim kanalı.

---

## 11. Hatalı Deployment ve Rollback

Hatalı bir sürüm deploy edildiğinde problemi nasıl tespit edersiniz?

Rollback işlemini hangi yöntemle gerçekleştirirsiniz ve önceki çalışan sürümün güvenli şekilde devreye alındığını nasıl doğrularsınız?

**Cevap:** **Tespit:** hatalı sürümü birkaç katman yakalar. CI'da derleme, API testleri (`backend-smoke-test`) ve manifest doğrulaması geçmezse imaj yayınlanmaz. Hata yine de geçerse, yeni pod'un readiness probe'u başarısız olur, rolling update ilerlemez ve eski sağlıklı pod'lar çalışmaya devam eder. Argo CD'de uygulama `Progressing`/`Degraded` görünür, `BackendHazirDegil` alarmı tetiklenir.

**Rollback:** Argo CD `selfHeal` açık olduğu için `kubectl rollout undo` etkisiz kalır, Argo değişikliği git'teki hâline geri çevirir. Bu yüzden rollback **git üzerinden** yapılır: hatalı imaj etiketini içeren commit `git revert` ile geri alınır ve push edilir, Argo CD önceki imaj etiketini kümeye uygular (yöntem README'de "Rollback" bölümünde).

**Doğrulama:** `kubectl rollout status deploy/backend -n devops-case` ile geçişin bittiğini, `kubectl get deploy backend -o jsonpath='{.spec.template.spec.containers[0].image}'` ile önceki imaj etiketinin çalıştığını, pod'ların `1/1 Running` olduğunu, Argo'da uygulamanın `Synced` ve `Healthy` olduğunu ve `/api/healthcheck` cevabının `OK` olduğunu kontrol ederim. Not: bu teslimde rollback'i canlı olarak denemedim, yöntem belgelendi.

---

## 12. Ölçeklenebilirlik ve Darboğazlar

Trafik 10 kat arttığında ilk darboğazın nerede oluşmasını beklersiniz?

Hangi bileşenleri, hangi metriklere ve eşiklere göre ölçeklersiniz? Veritabanı bağlantıları, kaynak kullanımı ve bağımlı servisleri nasıl değerlendirirsiniz?

**Cevap:** İlk darboğazın **MongoDB**'de ve tek düğümde oluşmasını beklerim: MongoDB tek kopya, 500m CPU ve 512Mi bellek limitiyle çalışıyor ve ölçeklenemiyor. Sonra backend gelir (2 kopya, 500m CPU, 256Mi bellek limiti, Node.js tek iş parçacıklı). Backend kopyası arttıkça her kopya MongoDB'ye kendi bağlantı havuzunu açacağı için MongoDB'ye gelen bağlantı sayısı da artar, bu yüzden backend'i sınırsız büyütmek sorunu MongoDB'ye taşır. Tüm bileşenler tek bir düğümü paylaşıyor, düğümün kendisi de sınırdır. Frontend yalnızca statik dosya sunduğu için en son darboğaz olur.

Nasıl ölçeklerim:
- **Backend ve frontend:** HorizontalPodAutoscaler ile CPU kullanımı ortalama %70'i (isteğe göre) geçince kopya artırırım. Şu an kurulu değil, `metrics-server` k3s'te mevcut.
- **MongoDB:** önce dikey büyütme (CPU, bellek), sonra replica set ve okumaları ikincil kopyalara dağıtma. İzlerim: bağlantı sayısı, CPU/bellek, yavaş sorgular, disk doluluğu.
- **Bağımlı servis:** ETL'in kullandığı GitHub API'nin saatlik istek sınırı (kimliksiz yaklaşık 60) ölçeklenmez, bu sınır trafikten bağımsız ve ETL'de hata mesajıyla görünür.

Ölçekleme davranışını yük testiyle denemedim, bu bir tahmindir.

---

## 13. Logging, Monitoring ve Alarm Yönetimi

Hangi logları, metrikleri ve alarmları oluşturdunuz?

Bir incident sırasında problemi teşhis etmek için ilk olarak hangi dashboard, log, metrik veya alarm kayıtlarını incelersiniz?

**Cevap:**

**Loglar:**
- Backend: her satırda zaman damgası, seviye (`INFO`, `WARN`, `ERROR`) ve istek başına bir satır (yöntem, yol, durum kodu, süre). Sağlık kontrolü istekleri gürültü yapmasın diye loglanmıyor (`mern-project/server/server.mjs`).
- ETL: her repository için sonucu (`yeni kayit olusturuldu` / `mevcut kayit guncellendi`), özet sayıları ve GitHub istek sınırı dolunca nedeni ve sıfırlanma saatini yazar.

**Metrikler ve alarmlar:** Prometheus (helm chart) kube-state-metrics ile Kubernetes nesnelerinin durumunu toplar. İki alarm kuralı var:
- `EtlJobBasarisiz`: başarısız bir ETL Job'u 1 dakika sürerse tetiklenir. Gerçek bir hatada (GitHub rate limit) tetiklendi.
- `BackendHazirDegil`: hazır olmayan backend kopyası 2 dakika sürerse tetiklenir. MongoDB'yi durdurarak tetikledim.

**Incident'ta ilk bakacaklarım:** (1) Alertmanager/Prometheus alarm sayfası hangi alarmın tetiklendiğini söyler, (2) `kubectl get pods -n devops-case` ve Argo CD durumu hangi bileşenin bozuk olduğunu gösterir, (3) `kubectl logs -l app=backend` ile hata satırlarına bakarım, (4) `/api/healthcheck` cevabı MongoDB'nin durumunu verir.

Eksikler: dashboard (Grafana) yok, loglar merkezi toplanmıyor (yalnızca `kubectl logs`), Prometheus verisi kalıcı değil (6 saat), Alertmanager'ın bildirim kanalı yok.

---

## 14. Güvenlik Riskleri

Çözümünüzde gördüğünüz en önemli üç güvenlik riski nedir?

Bu riskleri azaltmak için uyguladığınız veya production ortamında uygulayacağınız kontrolleri açıklayın.

**Cevap:**

1. **Uygulama MongoDB'ye root yetkili kullanıcıyla bağlanıyor, Secret düz tutuluyor.** Backend'in kullandığı `ATLAS_URI` MongoDB'nin yönetici kullanıcısına ait, yani backend ele geçirilirse tüm veritabanı açılır. Secret ise yalnızca base64 kodlu, kümede şifrelenmemiş ve elle oluşturuluyor. Productionda yalnızca gereken koleksiyona yetkili ayrı bir uygulama kullanıcısı tanımlar, Secret'ları harici bir yönetim aracından (Vault, External Secrets) çeker ve etcd şifrelemesini açardım.
2. **Trafik şifresiz ve küme içinde kısıtlama yok.** İstekler HTTP ile, MongoDB bağlantısı TLS'siz ve NetworkPolicy tanımlı olmadığı için herhangi bir pod MongoDB'ye ulaşabilir. Productionda Ingress'e TLS sertifikası (cert-manager), MongoDB bağlantısına TLS ve NetworkPolicy ile yalnızca backend, ETL ve yedek pod'larının MongoDB'ye erişmesini sağlardım.
3. **Yedekler şifresiz ve aynı kümede.** Küme ele geçirilirse ya da kaybolursa yedek de etkilenir. Productionda yedeği şifreleyip kümenin dışında, erişimi kısıtlı bir depolamaya kopyalardım.

Uyguladığım kontroller: tüm konteynerler root olmayan kullanıcıyla çalışıyor (backend 1000, frontend 101, MongoDB ve yedek işleri 999), tüm yetenekler düşürüldü (`drop: ALL`), `allowPrivilegeEscalation: false`, `seccompProfile: RuntimeDefault`, backend ve ETL'de salt okunur kök dosya sistemi, girdi doğrulaması (backend ve frontend), Secret'ın repoda olmaması. İmaj zafiyet taraması yapmadım, productionda CI'a eklerdim.

---

## 15. Python ETL Güncelleme Yaklaşımı

Python ETL aynı repository bilgisini tekrar aldığında mevcut kaydı nasıl bulup güncelliyor? Benzersiz kayıt anahtarı olarak hangi alanı kullandınız ve duplicate oluşmadığını hangi ekran görüntüsü veya çıktı ile gösterdiniz?

**Cevap:** ETL, kaydı **`_id`** alanıyla buluyor ve `update_one({"_id": repo_id}, ..., upsert=True)` ile yazıyor (`python-project/ETL.py`). `_id` değeri GitHub'ın repository'ye verdiği sayısal `id`. Bu kayıt varsa güncelleniyor, yoksa oluşturuluyor. Kimlik olarak `id` seçtim çünkü `full_name` (örneğin `kortangr/DevOps_Case`) repository yeniden adlandırılırsa ya da taşınırsa değişir, `id` değişmez. Her çalışmada `etl_son_calisma` güncelleniyor, `etl_ilk_kayit` yalnızca ilk yazımda atanıyor (`$setOnInsert`).

Kanıt (`TESLIM_KANITLARI.md` bölüm 4):
- `docs/screenshots/etl-ilk-calisma-yeni-kayit.png`: ilk çalışmada 9 repository için de "yeni kayit olusturuldu", koleksiyonda toplam 9 kayıt.
- `docs/screenshots/etl-ikinci-calisma-guncelleme.png`: ikinci çalışmada 9 repository için de "mevcut kayit guncellendi", toplam kayıt hâlâ 9, yani duplicate oluşmadı.

---

## 16. Backup ve Restore Yaklaşımı

MongoDB için hangi yedekleme yöntemini ve saklama konumunu seçtiniz?

Yedekleme sıklığı, retention süresi, RPO ve RTO hedefleriniz nedir ve ölçtüğünüz gerçek geri yükleme süresi ne kadar oldu?

Yedeğin bozuk veya eksik olmasına karşı hangi doğrulamayı yaparsınız; gerçek bir production ortamında bu yaklaşımı nasıl farklılaştırırdınız?

Runbook’unuzu `docs/backup-restore.md` içinde paylaşın ve kanıtları `TESLIM_KANITLARI.md` dosyasından referanslayın.

**Cevap:** **Yöntem ve konum:** `mongodump --gzip --archive` ile alınan sıkıştırılmış yedek, günlük `CronJob mongo-backup` ile `backup-pvc` (2Gi disk) içine `/backup/mongo-YYYYMMDD-HHMMSS.gz` olarak yazılıyor. **Sıklık:** günde bir, 02:00. **Retention:** 7 gün, her yedekten sonra eskiler siliniyor.

**Hedefler:** RPO 24 saat (yedek günde bir olduğu için, hesaplanan değer), RTO hedefi 15 dakika. **Ölçülen** geri yükleme süresi: **5 saniye** (`mongo-restore` Job'unun süresi, pod başlatma dahil). Bu yalnızca geri yükleme adımıdır, sorunu fark etme ve komutları çalıştırma süresini kapsamıyor.

**Doğrulama:** her yedekten sonra `gzip -t` arşivin bozuk olmadığını sınıyor, bozuksa iş başarısız oluyor. `mongodump` logu koleksiyon başına belge sayısını gösteriyor. Asıl doğrulamayı uçtan uca denedim: koleksiyonu sildim (sayım 0, arayüz boş), yedekten geri yükledim (`2 document(s) restored successfully`), sayımın 2'ye döndüğünü ve arayüzde kayıtların geri geldiğini gösterdim (`TESLIM_KANITLARI.md` bölüm 6).

**Productionda farklı:** yedeği kümenin dışında şifreli bir nesne depolamasına kopyalardım (şu an aynı düğümde ve şifresiz), geri yüklemeyi düzenli ve otomatik sınardım (şu an yalnızca elle denendi), yedek başarısız olursa ya da eskirse alarm üretirdim, RPO'yu düşürmek için replica set ve oplog ile belirli bir ana geri dönüş (point-in-time recovery) kurardım.

Runbook: `docs/backup-restore.md`.

---

## Ek Notlar

Case kapsamında özellikle belirtmek istediğiniz ek kararlar, sınırlamalar veya sonraki geliştirme adımları varsa bu bölümde açıklayabilirsiniz.

**Cevap:**

- **Sıfırdan kurulum doğrulandı.** Kümeyi silip README adımlarıyla yeniden kurdum, tüm kanıt görüntülerini bu kurulumdan aldım. Bu sırada README'deki bir hatayı buldum ve düzelttim: Secret oluşturma komutunda kullanıcı ve parola üç yerde elle yazılınca bağlantı adresi uyuşmadı ve backend `Authentication failed` ile yeniden başlayıp durdu. README artık değeri bir kez değişkene alıp bağlantı adresini oradan üretiyor.
- **GitOps ve dağıtım:** her değişiklik git'e gider, CI imajları üretip imaj etiketini manifestlere yazar, Argo CD bunu kümeye uygular. Kümede elle yapılan değişiklikler geri çevrilir (`selfHeal`).
- **Bilinen sınırlamalar:** tek düğüm, tek MongoDB kopyası, yedeğin aynı kümede olması, alarm bildirim kanalının, dashboard'un ve kalıcı metrik/log depolamanın olmaması, NetworkPolicy ve TLS'in olmaması. Ayrıntılar `docs/findings.md` ve bu dosyanın ilgili cevaplarında.
- **Sonraki adımlar:** MongoDB replica set, harici şifreli yedek, HPA, alarm bildirim kanalı, uygulama için ayrı MongoDB kullanıcısı, imaj zafiyet taraması ve otomatik geri yükleme testi.
- **Yapay zekâ kullanımı:** bu dosyadaki cevap taslakları (Soru 1 hariç) yapay zekâ asistanı (Claude) ile hazırlandı. İçerik repodaki dosyalara ve çalıştırılan komutların çıktılarına dayanıyor. Genel kullanım notu `README.md` içinde.
