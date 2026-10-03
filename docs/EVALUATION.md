# Evaluasi Hardening dan Windows 11

Dokumen ini adalah panduan evaluasi lokal untuk branch `evaluation-hardening`. Cakupannya hanya hardening offline; ini bukan bukti bahwa Google Flow, browser, akun, atau pembuatan media telah tervalidasi.

## Bukti evaluasi

- Pada Linux evaluator, `npm run check`, build, health check, dan 14/14 pengujian regresi lulus.
- Perbaikan mencakup serialisasi pembuatan job ber-idempotency per `StateStore`, isolasi lingkungan stdio, dan pembatasan akses upload, media, unduhan, serta backup ke root yang dikonfigurasi.
- Validasi filesystem menolak traversal, file non-reguler, keluarnya symlink dari root, dan keluaran yang sudah ada. Unduhan memakai penulisan eksklusif.
- Tidak ada browser yang diluncurkan, login, penggunaan kredit, integrasi akun Google Flow, atau browser E2E pada evaluasi ini.

## Batasan yang tersisa

- Serialisasi hanya berlaku dalam satu proses dan satu instance `StateStore`; ini bukan jaminan transaksi lintas-proses. Jalankan satu proses MCP untuk satu direktori data evaluasi privat.
- Pemeriksaan filesystem bukan sandbox sistem operasi. Penggantian symlink lokal secara bersamaan masih dapat memicu race TOCTOU; pemeriksaan file backup yang sudah ada juga belum merupakan pembuatan eksklusif atomik.
- Persetujuan penggunaan kredit tetap bergantung pada kebijakan pemanggil.
- Health check hanya memeriksa keberadaan executable browser, bukan kemampuan browser untuk benar-benar diluncurkan.

## Windows 11 dengan OpenCode

Prasyarat: Git, Node.js >=22.13, pnpm 10.32.1, Chrome/Edge, dan FFprobe. Periksa versi sebelum memasang dependensi; panduan ini tidak memasang tool global secara otomatis. Tes symlink mungkin memerlukan Windows Developer Mode atau izin pembuatan symlink. Jangan menonaktifkan tes keamanan hanya agar hasil lulus. Ganti semua `<pengguna>` dan path contoh dengan lokasi sebenarnya. `FLOW_PROFILE_DIR`, `FLOW_STATE_FILE`, `FLOW_DATABASE_FILE`, dan `FLOW_DOWNLOAD_DIR` dari sesi sebelumnya harus dibersihkan atau diarahkan ke folder evaluasi agar tidak memakai data lama.

Jangan gunakan akun nyata, secret login, cookie/profil browser yang ada, atau data akun Google Flow pada evaluasi ini.

1. Clone branch yang ditinjau, lalu masuk ke direktori proyek:

```powershell
git clone --branch evaluation-hardening https://github.com/dissemut-ramliankar/google-flow-mcp.git google-flow-mcp
Set-Location .\google-flow-mcp
```

2. Instal dependensi secara lokal tanpa menjalankan lifecycle script:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
```

3. Tetapkan browser dan seluruh penyimpanan ke lokasi evaluasi yang eksplisit. Sesuaikan hanya jika Chrome dipasang di lokasi lain:

```powershell
$env:FLOW_BROWSER_EXECUTABLE = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:FLOW_DATA_DIR = "C:\Users\<pengguna>\google-flow-evaluation\data"
$env:FLOW_ASSET_DIR = "C:\Users\<pengguna>\google-flow-evaluation\assets"
```

`FFprobe` wajib tersedia pada `PATH` untuk validasi media dan health check. Contoh pemeriksaan:

```powershell
ffprobe -version
```

4. Jalankan pemeriksaan dan build. Jangan gunakan `npm test` di PowerShell: script itu khusus Linux karena memakai `mkdir -p` dan penetapan `TMPDIR` gaya shell Linux.

```powershell
npm run check
npm run build
New-Item -ItemType Directory -Force .evaluation\tmp | Out-Null
$env:TMPDIR = (Resolve-Path .evaluation\tmp).Path
node --test dist/test/filesystem.test.js dist/test/state.test.js dist/test/server.test.js dist/test/stdio.test.js
```

Hasil `14/14` yang tercatat hanya bukti Linux. Jalankan perintah di atas untuk memperoleh bukti Windows lokal; jangan menyatakan hasil Linux sebagai hasil Windows.

5. Pada konfigurasi proyek OpenCode, gabungkan entri berikut ke objek `mcp` yang sudah ada. Jangan mengganti seluruh file konfigurasi atau menghapus server MCP lain. Semua path harus absolut dan memakai lokasi evaluasi privat:

```jsonc
{
  "mcp": {
    "google-flow": {
      "type": "local",
      "command": [
        "node",
        "C:\\Users\\<pengguna>\\src\\google-flow-mcp\\dist\\src\\index.js"
      ],
      "environment": {
        "FLOW_BROWSER_EXECUTABLE": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "FLOW_DATA_DIR": "C:\\Users\\<pengguna>\\google-flow-evaluation\\data",
        "FLOW_ASSET_DIR": "C:\\Users\\<pengguna>\\google-flow-evaluation\\assets"
      }
    }
  }
}
```

Setelah build, mulai ulang OpenCode dari direktori proyek agar server stdio lokal dimulai dengan environment tersebut. Jangan memasukkan password, kode 2FA, token, cookie, atau profil browser ke konfigurasi.

## Pengujian akun dan pembersihan

Pengujian akun/browser memerlukan persetujuan pengguna baru yang eksplisit untuk setiap sesi. Jika disetujui, lakukan login sendiri di browser yang terlihat, jangan menghasilkan media, dan jangan menyetujui penggunaan kredit. Browser E2E belum tersedia.

Hapus hanya file dan direktori yang dibuat oleh pengujian ini, misalnya direktori data/aset evaluasi dan `.evaluation\\tmp` yang Anda buat. Jangan menghapus profil, database, unduhan, atau aset yang sudah ada dan bukan milik pengujian.
