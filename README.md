# Moli TuTu

A native image uploader and compressor for macOS, Windows and Linux, written in Go with [mygo](https://github.com/egoist/mygo). No WebView, no HTML, no JavaScript, and no frontend build step.

- Landing page: <https://tutu.eztoolab.com/>
- Releases: <https://github.com/gusibi/moli-tutu/releases>
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Migration spec: [SPEC.md](./SPEC.md)

## What changed in 0.6

The previous Tauri + React app has been fully replaced by a native Go application:

- Native UI drawn on the GPU: Metal on macOS, Direct3D 11 on Windows, OpenGL on Linux
- Liquid Glass sidebar on macOS 26+, with a solid content pane
- Single Go binary, no WebView or frontend runtime
- Same 14 storage providers, upload history, compression, compression history, multi-config and local API proxy
- First-run migration of the old Tauri `config.json`, `settings.json` and `uploads.db`
- Apple-style motion and typography: spring page transitions, press feedback, size-aware tracking

## Build and run

Go 1.27.3+ is required by mygo.

```sh
GOTOOLCHAIN=auto GOSUMDB=sum.golang.org go test ./...

# Native development app
GOTOOLCHAIN=auto GOSUMDB=sum.golang.org go tool mygo dev

# Package for the current machine (macOS example)
GOTOOLCHAIN=auto GOSUMDB=sum.golang.org \
  go tool mygo build -platform darwin/arm64 -skip-dmg -skip-notarize -sign -
```

The packaged app is written to `dist/darwin-arm64/Moli TuTu.app`.

## Features

- Drag/drop, file picker, clipboard and URL upload
- 14 storage providers: Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces, MinIO, Wasabi, Aliyun OSS, Tencent COS, Qiniu Kodo, custom S3, Imgur, SM.MS, GitHub and Upyun
- SHA-256 upload cache, recent history, search, pagination, preview, copy, download, delete and clear
- Image compression: JPEG, PNG and WebP; quality, resize, aspect ratio, premultiply alpha, linear RGB, palette reduction and dithering
- Before/after split preview, save and direct upload
- Compression history with restore, delete and clear
- Local API proxy on `127.0.0.1` with port validation
- Chinese/English, light/dark/system theme
- Native menus, window state, toasts, confirmations and rotating file logs

## Shortcuts

- `Cmd+O` — choose images (upload and compress pages)
- `Shift+Cmd+V` — paste an image from the clipboard (upload and compress pages)
- `Cmd+R` — refresh upload history

## Structure

| Package | Responsibility |
|---|---|
| `internal/app` | Native view, pages, dialogs, thumbnail cache |
| `internal/service` | The single testing seam: view-facing API plus the real implementation |
| `internal/model` | JSON-compatible data shapes |
| `internal/store` | Config/settings JSON, SQLite upload history, compression history, old-data migration |
| `internal/storage` | S3 SigV4 uploader and Imgur/SM.MS/GitHub/Upyun uploaders |
| `internal/imaging` | Decode, EXIF orientation, resize, palette/dithering, JPEG/PNG/WebP encode |
| `internal/proxy` | Localhost multipart upload endpoint |
| `internal/logging` | Rotating log file |

## Known gaps

- Real AVIF encoding is not implemented; the AVIF choice keeps the old WebP fallback.
- Old compression history in the previous WebView's IndexedDB is not migrated; it is explained on first launch.
- Menu bar mode and auto-update are not implemented yet.
- The packaged macOS app uses ad-hoc signing unless `macos.signingIdentity` is configured in `mygo.json`.
