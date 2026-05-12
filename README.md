# Discord Sesli Kayıt Botu

> Merhaba ben darkdays, bugün sizlere Discord sunucularında kullanabileceğiniz **sesli kayıt sistemini** bırakıyorum. Üye ses kanalına giriyor, ismini ve yaşını söylüyor, bot Whisper AI ile sesi yazıya çeviriyor ve otomatik kayıt yapıyor.

> Kayıtsız girince hoşgeldin müziği çalar, sesini dinler, AI ile isim-yaş çıkarır, cinsiyet belirler ve otomatik kayıt yapar. Ses bağlantısı koparsa kendi toparlar. Çoklu token desteği de mevcut.

> Kullanın, geliştirin, paylaşın sorun değil ama yarın bir yerde görüp "altyapı bana ait" diye developer hallerine girmeyin yeter.

---

## Özellikler

### Kayıt Sistemi
- **Sesli Kayıt**: Üye ismini ve yaşını söyler, Whisper AI ile yazıya çevrilir
- **Metin Desteği**: Ses algılanmazsa metin kanalından `Ad Yaş` formatında yazabilir
- **Otomatik Cinsiyet**: Groq AI ile isimden cinsiyet tahmini yapılır
- **3 Deneme Hakkı**: Yanlış söylerse tekrar deneyebilir (kanaldan çıkmasına gerek yok)

### Güvenlik
- **Küfür Filtresi**: 500+ kelimelik Türkçe küfür listesi ile kontrol
- **Yaş Sınırı**: Minimum ve maksimum yaş kontrolü (varsayılan: 18-100)
- **Findcord Entegrasyonu**: Sicil kaydı kontrolü (3+ sicilli kullanıcılar reddedilir)
- **Otomatik İptal**: Kullanıcı kanaldan çıkarsa işlem anında durur

### Teknik
- **Çoklu Bot Desteği**: Birden fazla token ile çalışma
- **Otomatik Yeniden Bağlanma**: Bağlantı koparsa kendi toparlar
- **Yetkili Aktarımı**: Kayıt seslerinde yetkili varsa kayıtsızı direkt yetkili kanalına aktarır

---

## Gereksinimler

### Node.js
**v22** veya üzeri gereklidir.

[node-v22.17.0-x64.msi](https://nodejs.org/dist/v22.17.0/node-v22.17.0-x64.msi) — Windows x64

### FFmpeg
Ses işleme için zorunludur. İndirip sistem PATH'ine eklemeniz gerekiyor.

[ffmpeg-release-essentials.7z](https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.7z)

<details>
<summary>FFmpeg PATH ayarı nasıl yapılır?</summary>

1. İndirilen arşivi açın, içindeki `bin` klasörünün tam yolunu kopyalayın
   - Örn: `C:\ffmpeg\bin`
2. Başlat menüsünde **"Ortam Değişkenleri"** arayın
3. **PATH** değişkenini düzenleyin ve yeni değer olarak `C:\ffmpeg\bin` ekleyin
4. Terminali kapatıp yeniden açın, `ffmpeg -version` yazarak test edin

</details>

---

## API Anahtarları

### Groq API (Zorunlu)
Ses tanıma (Whisper) ve cinsiyet tahmini (LLaMA) için kullanılır.

1. [console.groq.com](https://console.groq.com) adresine gidin
2. Google veya GitHub ile giriş yapın
3. Sol menüden **API Keys** seçin
4. **Create API Key** butonuna tıklayın
5. İsim verin ve oluşturulan anahtarı kopyalayın (`gsk_` ile başlar)

> **Ücretsiz**: Groq API ücretsizdir ve oldukça yüksek limitler sunar.

### Findcord API (Zorunlu)
Kullanıcı sicil kontrolü için kullanılır. Kayıtlı kullanıcıların geçmiş ceza kayıtlarını kontrol eder.

1. [findcord.com](https://discord.com/channels/1224170151356792942/1340104783477866547) adresine gidin
4. API anahtarınızı Oluşturun

> **Not**: Findcord kullanmak istemiyorsanız `findcordApi` alanını boş bırakın.

### Discord Bot Token
1. [discord.com/developers/applications](https://discord.com/developers/applications) adresine gidin
2. **New Application** ile uygulama oluşturun
3. Sol menüden **Bot** seçin
4. **Reset Token** ile token oluşturun ve kopyalayın

---

## Kurulum

```bash
# Repoyu klonla
git clone https://github.com/kullaniciadi/discord-welcome-bot.git
cd discord-welcome-bot

# Bağımlılıkları kur
npm install
```

---

## Yapılandırma

`src/config/settings.ts` dosyasını açıp aşağıdaki alanları doldurun:

```ts
export const settings = {
    Welcome: {
        token: ['BOT_TOKEN'],                // Bot token'larınız (birden fazla olabilir)
        voice: ['KAYIT_SES_KANALI_ID'],      // Kayıt ses kanalları (her bot için bir tane)
        guildID: 'SUNUCU_ID',                // Sunucu ID'niz
        staff: ['YETKILI_ROL_ID'],           // Yetkili rol ID'leri
        unregister: ['KAYITSIZ_ROL_ID'],     // Kayıtsız üye rol ID'leri
        findcordApi: 'FINDCORD_API_KEY',     // Findcord API
        botActivity: ['Metin'],              // Bot aktivite metni
        botActivityType: ['Playing'],        // Playing, Watching, Listening
        botStatus: ['dnd'],                  // online, idle, dnd, invisible
    },

    Register: {
        minRegisterAge: 18,                  // Minimum kayıt yaşı
        maxRegisterAge: 100,                 // Maximum kayıt yaşı
        registerLog: 'LOG_KANAL_ID',         // Kayıt loglarının atılacağı kanal
        registerChannel: 'METIN_KAYIT_ID',   // Metin ile kayıt kanalı
        publicParents: ['KATEGORI_ID'],      // Kayıt sonrası atılacak kategori ID'leri
        manRoles: ['ERKEK_ROL_ID'],          // Erkek rolleri
        womanRoles: ['KADIN_ROL_ID'],        // Kadın rolleri
        voiceTimeout: 30000,                 // Ses bekleme süresi (ms)
        textTimeout: 60000,                  // Metin bekleme süresi (ms)
        groqKey: 'GROQ_API_KEY',             // Groq API anahtarı
    },
};
```

### ID Nasıl Alınır?

1. Discord'da **Ayarlar → Gelişmiş → Geliştirici Modu**'nu açın
2. Sunucu/kanal/rol üzerine sağ tıklayın
3. **"ID'yi Kopyala"** seçin

---

## Müzik Dosyaları

`src/music/` klasörüne şu dosyaları koyun:

| Dosya | Ne Zaman Çalar |
|-------|----------------|
| `hosgeldin.mp3` | Kayıtsız üye kanala girdiğinde |
| `aktariliyor.mp3` | Yetkili varken kullanıcı aktarılırken |
| `algilanmadi.mp3` | Ses algılanamadığında (metin istenir) |
| `basarili.mp3` | Kayıt başarıyla tamamlandığında |
| `hata.mp3` | Hata durumunda (küfür, 3 başarısız deneme vb.) |
| `yas.mp3` | Yaş sınırı dışında olduğunda |

---

## Çalıştırma

```bash
# Geliştirme modunda
npm run dev

# Normal başlatma
npm start

# PM2 ile (önerilen)
pm2 start ecosystem.config.js
```

---

## Kayıt Akışı

```
Kayıtsız üye ses kanalına girer
         ↓
   hosgeldin.mp3 çalar
         ↓
    Ses kaydı alınır
         ↓
  Whisper AI ile yazıya çevrilir
         ↓
    İsim ve yaş çıkarılır
         ↓
   ┌─────┴─────┐
   ↓           ↓
Başarılı    Başarısız
   ↓           ↓
Küfür      algilanmadi.mp3
kontrolü   Metin istenir
   ↓           ↓
Yaş        3 deneme hakkı
kontrolü       ↓
   ↓       Hepsi başarısız
Findcord       ↓
kontrolü   hata.mp3 çalar
   ↓
Cinsiyet belirlenir
   ↓
Roller verilir, isim değiştirilir
   ↓
basarili.mp3 çalar
   ↓
Rastgele public kanala atılır
```

---

## Proje Yapısı

```
discord-welcome-bot/
├── src/
│   ├── app/
│   │   └── index.ts          # Ana bot mantığı
│   ├── base/
│   │   ├── client.ts         # Discord client sınıfı
│   │   └── logger.ts         # Renkli terminal logları
│   ├── config/
│   │   └── settings.ts       # Tüm yapılandırma
│   └── music/
│       ├── hosgeldin.mp3
│       ├── aktariliyor.mp3
│       ├── algilanmadi.mp3
│       ├── basarili.mp3
│       ├── hata.mp3
│       └── yas.mp3
├── ecosystem.config.js       # PM2 yapılandırması
├── package.json
└── tsconfig.json
```

---

## Lisans

Bu proje **MIT Lisansı** ile lisanslanmıştır. Detaylar için [LICENSE](./LICENSE) dosyasına bakabilirsiniz.

Kısacası: kullanabilirsin, düzenleyebilirsin, dağıtabilirsin — tek ricam başkalarına aitmiş gibi sunma.
