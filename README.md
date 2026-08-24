# 🔄 Local File Converter

Private file converter that works **entirely in your browser**: images, audio, and documents
are converted without uploading to a server. No registration, queues, or limits - your files
never leave your computer.

> 🔒 **Your files stay in your browser.** Everything runs locally: not a single byte of your
> files is sent to a server. The only network request is a one-time download of the ffmpeg
> audio engine (~31 MB) during the first audio conversion; after that, it is loaded from the cache.

## Why It Is Better Than Online Converters

- **Privacy** - files are not uploaded to third-party servers (screenshots, contracts, and keys stay with you).
- **Fast** - no upload or download time; conversion starts immediately.
- **Free and unlimited** - it uses your computer's power instead of service quotas.
- **Transparent code** - open source, so you can verify that files are not sent over the network.

## Features (MVP)

| Category | Input formats | Output formats | Engine |
|---|---|---|---|
| 🖼️ Images | PNG, JPG, WEBP, AVIF, GIF, BMP, HEIC* | PNG, JPG, WEBP, AVIF* | Canvas API |
| 🎵 Audio | MP3, WAV, OGG, M4A, AAC, FLAC, OPUS... | MP3, WAV, OGG | ffmpeg.wasm |
| 📄 Documents | MD, HTML, TXT | HTML, PDF, MD, TXT | marked + turndown + jsPDF |

* AVIF encoding and HEIC decoding depend on the browser: if support is unavailable, the app
  reports it clearly and offers an alternative (WEBP) instead of producing a broken file.

UI features: drag-and-drop or file selection, target format and quality selection, a progress
bar, before/after sizes with the percentage delta, and a "Download all" button.

## Run Locally

Requires [Node.js](https://nodejs.org) 20+.

```bash
npm install
npm run dev        # open http://localhost:5173
```

Production build:

```bash
npm run build
npm run preview    # test the production build at http://localhost:4173
```

## Architecture

Each category is a separate converter module with a shared contract:

```
src/converters/
├── types.ts      <- Converter interface: canConvert() + convert()
├── image.ts      <- images through the Canvas API
├── audio.ts      <- audio through ffmpeg.wasm (lazy engine loading)
├── document.ts   <- MD/HTML/TXT/PDF through marked, turndown, and jsPDF
└── index.ts      <- registry: findConverter(file) selects a converter automatically
```

**Add a new format in 3 steps:**

1. Define `TargetFormat` in the converter module (extension, MIME type, lossy/lossless).
2. Write or extend `convert()` - the UI (format selector, quality slider, and progress) picks it up automatically.
3. For a new category, create a module implementing `Converter` and add one line to the `converters` array in `src/converters/index.ts`.

## Limitations

- The ffmpeg audio engine (~31 MB) is downloaded from a CDN during the first audio conversion - an internet connection is needed once; subsequent runs use the browser cache.
- PDFs are generated as raster images (html2canvas), so text cannot be selected and the file is larger than a vector PDF. The benefit is that Cyrillic works without embedding fonts.
- AVIF encoding is supported by Chrome/Edge and recent Firefox; it is unavailable in Safari (the app reports this in the UI).
- SVG input is not supported (Canvas cannot rasterize it reliably).

## Roadmap: 5 Next Steps

1. **Batch conversion with ZIP** - the queue already exists; add jszip and a "Download all as archive" button.
2. **PWA for offline use** - `vite-plugin-pwa` plus a self-hosted ffmpeg-core in the cache: the app becomes fully offline after its first opening.
3. **Video** - the same ffmpeg.wasm already supports MP4, WEBM, and animated GIFs (trimming, cropping, and resizing).
4. **Quality presets** - "web", "maximum compression", and "lossless" instead of a manual slider; save the user's choice in localStorage.
5. **More document formats** - DOCX through mammoth.js (reading) and PDF parsing through pdf.js: DOCX -> MD/HTML/PDF and PDF -> TXT/MD.

## License

MIT - do whatever you want.
