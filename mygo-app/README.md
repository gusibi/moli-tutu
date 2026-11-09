# Moli TuTu Native (mygo)

This directory is the new, pure-Go native implementation of Moli TuTu.

It is intentionally separate from the existing Tauri app (`src/`, `src-tauri/`) so that both implementations can coexist during the migration. The old app remains the shipping version until the new one reaches full feature parity.

- Migration spec: [SPEC.md](./SPEC.md)
- UI: mygo native UI (`ui.View`), no WebView
- Language: Go 1.27.3+, no cgo
- Framework: mygo v0.8.3 (pinned in `go.mod`)

## Build and run

```sh
# Go 1.27.3 is required by mygo.
GOTOOLCHAIN=auto GOSUMDB=sum.golang.org go test ./...

# Native development app
GOTOOLCHAIN=auto GOSUMDB=sum.golang.org go tool mygo dev

# Package for the current machine (macOS example)
GOTOOLCHAIN=auto GOSUMDB=sum.golang.org \
  go tool mygo build -platform darwin/arm64 -skip-dmg -skip-notarize -sign -
```

The packaged app is written to `dist/darwin-arm64/Moli TuTu.app`.

## History refresh

The recent-upload list refreshes after each file finishes, and has its own Refresh button. A repeated image that hits the SHA-256 cache moves its existing history row to the top instead of adding a duplicate row.

## Shortcuts

- `Cmd+O` — choose images (upload and compress pages)
- `Shift+Cmd+V` — paste an image from the clipboard (upload and compress pages)

macOS may use the first click on an inactive window only to activate it. If a button click seems to do nothing, click the window once and try again, or use the shortcuts above.

## Structure

| Package | Responsibility |
|---|---|
| `internal/app` | Native view, pages, dialogs, thumbnail cache |
| `internal/service` | The single testing seam: view-facing API plus the real implementation |
| `internal/model` | JSON-compatible data shapes |
| `internal/store` | Config/settings JSON, SQLite upload history, compression history, Tauri migration |
| `internal/storage` | S3 SigV4 uploader and Imgur/SM.MS/GitHub/Upyun uploaders |
| `internal/imaging` | Decode, EXIF orientation, resize, palette/dithering, JPEG/PNG/WebP encode |
| `internal/proxy` | Localhost multipart upload endpoint |

## Implemented in this pass

- Native window, sidebar, five pages, Chinese/English, light/dark/system theme
- Drag/drop, file picker, clipboard, URL upload
- 14 storage providers, including S3-compatible providers with path-style handling for R2/MinIO
- Upload history with SHA-256 cache, search, pagination, copy, open, preview, download, delete, clear
- Image compression with format, quality, resize, aspect ratio, real advanced options, before/after split preview, save, upload
- Compression history with restore/delete/clear
- Local API proxy with port validation and status
- First-run migration of `config.json`, `settings.json`, `uploads.db` from the old Tauri data directory
- Native menus, title bar, window state, toasts and confirmations

## Known gaps

- Real AVIF encoding is not implemented; the AVIF choice keeps the old WebP fallback.
- Old compression history in the WebView's IndexedDB is not migrated; it is explained on first launch in the app data.
- Auto-update and tray/menu-bar mode are out of scope for this version.
- The packaged macOS app uses ad-hoc signing unless `macos.signingIdentity` is configured in `mygo.json`.
