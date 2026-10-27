1.Healtcheck: healtcheck.mjs dosyasındaki kod MongoDb ile iletişim kurmadan, herhangi başka bir kontrol de yapmadan "OK" döndürüyordu. Bu durum sistem sağlığı hakkında yanılgı yaratıyordu. Mongo çökse bile podlar sağıklı görünüyordu dolayısıyla da podlardan istekler akmaya devam ediyordu. Bu sorunu çözmek için Healtcheck.mjs nin mongo'ya ping atmasını sağladım. Bu ping 2 saniye içinde cevaplanmazsa da 503 döndürmesini istedim ve bu 503'ü readiness probe'ye bağladım.  readiness probe bir HTTP isteğini healthcheck.mjs'ye atıyor, healtcheck ise bunu mongoya ping olarak gönderiyor gelen cevaba göre sağılıklı(200), sağlıksız(503) döndürüyor.
Etki: MongoDb çöktüğünde haber alınmaması ve farkedilene kadar sistemin kullanılamaması.
Önem: Yüksek
------------------------------------------------------------------------------------------------
2. Backend'in id biçimine uymayan bir istek(örneğin api/record/aaaaa gibi) gönderildiğinde backend bu id geçersiz hatası veriyor fakat bu hatanın herhangi bir kodu vs. olmadığı için kullanıcıya bilgi verilemiyor ve backend çöküyor. Bu sorunu bu hatayı id formatına uymayan bir id geldiğinde 400 kodunu döndürerek çözdüm ve sonucunda backend çökmek yerine hata kodunu döndürdü.
Etki: Geçersiz id kullanılarak atılan bir istek sistemi çökertiyor
Önem: Yüksek
-------------------------------------------------------------------------------------------------
3. Programların sağlık durumu ve kaynak kullanımı hakkında herhangi bir bilgi aktarımı ve sınırlama yoktu. Podların takılıp cevap vermemesi veya bağımlılığının çalışmaması durumunda kubernetesin bundan haberi olmuyor, sızıntı olduğunda yüksek seviyelerde CPU ve bellek kullanabiliyorlardı. Bu soruna Readiness ve liveness probeleri getirerek backend, mongodb ve frontend için bu bilgileri düzenli olarak alarak çözüm buldum. Bu probeleri k8sdeki ilgili(backend-deployment,frontend-deployment ve mongo-statefulset) dosyaların içine yerleştirdim. Resource ve request sınırlamalarını kaba taslak bir ölçümle koydum.
Etki: Sorunlu bir pod istek almaya devam eder ve istekler boşa gider. Bir program yüksek CPU ve Bellek kullanımı ile makineyi yorabilir.
Önem: Yüksek
-----------------------------------------------------------------------------------------------
4. Update ve Create işlemlerinde Backend gelen bilgiye bakmıyordu, Name, level ve position değerleri için bir sınırlama koymuyordu. Dolayısıyla bir api kullanıcısı İsmi ve pozisyonuna uzun girdiler, seviyesinde ise verilen 3 seçenek dışındaki seviyeleri kullanabiliyordu. Çözümü name, position ve level değerlerine kısıtlamalar getirerek sağladım. Backendde record.mjs dosyasında, frontendde validation.js dosyasında filtreler kurarak bu sonuca ulaştım.
Etki: Kayıtlarda yazım hataları veya olmayan pozisyonlar oluşması
Önem: Orta
------------------------------------------------------------------------------------------------
5. Conn.mjs dosyasının ilk halinde MongoDb kapalı veya ulaşılamayan bir durumda olduğunda ve Backend ona bağlanmaya çalıştığında bağlantı hatası oluşuyordu. Ardından catch bloğu hatayı ekrana yazıyordu fakat program durmuyordu. Program devam ettiği için conn.mjs olmayan bir yerde işlem yapmaya çalışıyor ve hata alıp programı kapatıyordu. Son halinde ise bağlantı başarılı olunca "MongoDb bağlantısı kuruldu" yazısı, başarısız olduğunda ise hata mesajı verip programı kendisi kapatıyor. Kubernetes kapanan programı tekrar başlatıyor ve MongoDb tekrar deneniyor.
Etki: Bağlantı durumu takip edilemiyor, başarısız bağlantı durumunda program durmuyor
Önem: Orta
-------------------------------------------------------------------------------------
 6. record.mjs dosyasında backend cevap gönderirken durum kodunu cevaptan sonra ayarlamaya çalışıyordu (res.send(...).status(404) şeklinde). Cevap önce gönderildiği için durum kodu hiçbir işe yaramıyordu ve her cevap 200 (başarılı) olarak gidiyordu. Bulunamayan kayıt için bile 200 dönüyordu, kayıt oluşturmada da 201 yerine 200 dönüyordu. Durum kodunu cevaptan önce ayarlayarak (res.status(...).send(...)) çözdüm. Artık oluşturma 201, geçersiz girdi 400, bulunamayan kayıt 404, başarılı işlem 200 döndürüyor. Güncelleme ve silmede de kayıt bulunamazsa 404 dönüyor. scripts/api-test.sh bunu CI'da test ediyor (silinmiş kayıt için 404).
   Etki: İstemci ve izleme araçları hataları göremiyor, her cevap başarılı görünüyor.
   Önem: Orta
-----------------------------------------------------------------------------------------------------
7. MongoDB, yedek ve geri yükleme pod'ları root (en yetkili kullanıcı) olarak çalışıyordu. Backend ve frontend için de yetki kısıtlaması yoktu. Konteynerleri yetkisiz bir kullanıcı ile çalıştırarak gereksiz yetkilere sahip olmalarının önüne geçtim.
Önem: Düşük, Güvenlik
---------------------------------------------------------------------------------------------------
8. Backend podunun işlemlerini takip etmek için loglara baktığımda logda sadece connecting to Atlas ve Server listening loglarının olduğunu gördüm. Zaman bilgisi, önem bilgisi, gelen istekler ve hatalar gözükmüyor bağlantı kurulup kurulmadığını söylemiyordu. Her satıra zaman damgası ve seviye ekleyerek her istek için bir satır ayırarak bilgilendirici bir log formatı hazırladım. 
Etki: Backendde bir sorun çıktığında ne olduğunu anlamak zordu.
Önem: Düşük
------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------
Kapsam Dışı Bırakılanlar

1.Yedek dosyaları clusterın içinde ve şifresiz tutuluyor. Makine veya makinenin diski giderse yedek de kayboluyor. Yerelde ve tek node olan bir ortamda çalıştığım için dışarıda bir yedek ortamı yapmadım. Productionda bir Cloud depolama alanına yedekleri kaydedecek bir sistem kurardım ve bu alana erişimi şifreli ve kısıtlı olarak ayarlardım.
---------------------------------------------------------------------------------------------------------------------
2. Alertmanager alarmaları kendi sayfasında doğru şekilde gösteriyor fakat bu alarm sayfadan dışarıya sms, e-posta veya benzeri yollar ile çıkmıyor. Yani sistemin bir alarm bildirim kanalı yok. Porductionda alertmanager'ı slack veya e-posta sistemine bağlardım.
-------------------------------------------------------------------------------------------------------------
3. Kendi Macbookumda k3d sistemini kurduğum için Cronjoblar mac uykuda iken çalışamıyor. Saat başı çalışan ETL ve günlük yedek işlevleri bu yüzden pek sağlıklı çalışmıyor. Yerel ortamı seçtiğim için bu konuda bir çözüm bulmadım. Productionda yönetilen bir kubernetes servisi veya çok nodeli bir sistem kurardım.
-----------------------------------------------------------------------------------------------------
4. Başlangıç projesinde cypress testi vardı fakat ben bu testi CI'a bağlamadım. Temel test ve doğrulama şartını API tesleri ile (scripts/api-test.sh) ile sağladım. Productionda cypress veya benzeri bir testi de CI'a eklerdim.
------------------------------------------------------------------------------------------------
5. İmajlar hem amd64 hem arm64 için üretiliyor. GitHub'ın makineleri amd64 olduğu için arm64 imajı QEMU ile (işlemci taklidi) derleniyor ve bu, özellikle frontend'in derlemesinde pipeline'ı belirgin biçimde yavaşlatıyor. Arm64'ü Mac'imde k3d çalıştırdığım için ekledim. Çalışmayı etkilemiyor, yalnızca yeni sürümün yayına çıkışı gecikiyor. Productionda arm64'ü gerçek arm64 runner'da derler, yalnızca hedef platformu üretir ve Docker derleme önbelleği eklerdim.