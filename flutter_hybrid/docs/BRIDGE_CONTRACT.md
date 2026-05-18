# Flutter Hybrid Bridge Contract

## Channel
Semua command dari web ke Flutter dikirim lewat:
- `window.NativeBridge.postMessage(JSON.stringify(payload))`

Semua event dari Flutter ke web dikirim lewat:
- `window.dispatchEvent(new CustomEvent('<event-name>', { detail: payload }))`

## 1) Command: Pick Media (Legacy/Fallback)
Web -> Flutter:
```json
{ "type": "pick_media" }
```

Flutter -> Web event `native-media`:
```json
{
  "type": "media_selected",
  "name": "file.jpg",
  "mime": "image/jpeg",
  "base64": "..."
}
```

## 2) Command: Upload Task Media (Recommended)
Web -> Flutter:
```json
{
  "type": "upload_task_media",
  "upload_url": "/api/tasks/upload-media",
  "bearer_token": "<jwt>",
  "task_id": "123",
  "device_id": "<device-id>"
}
```

Notes:
- `task_id` opsional (create task bisa tanpa task id).
- `upload_url` boleh absolute atau relative terhadap host web app.

Flutter behavior:
1. Buka picker native (kamera/galeri)
2. Upload multipart langsung ke `upload_url` dengan field:
- `media`: file
- `task_id`: jika tersedia
3. Kirim hasil ke web.

Flutter -> Web event `native-upload-result` success:
```json
{ "ok": true, "documentation_image_url": "https://..." }
```

Flutter -> Web event `native-upload-result` error:
```json
{ "ok": false, "message": "Upload failed" }
```

## 3) Notification Bridge
Flutter -> Web event `native-notification`:
```json
{ "deep_link": "/tasks/123" }
```

Web handling recommendation:
- `/tasks` -> buka halaman tasks
- `/reports` -> buka halaman reports
- `/notifications` -> buka halaman notifications
- default -> dashboard

## 4) Compatibility Strategy
- Jika `NativeBridge` tersedia: utamakan `upload_task_media`.
- Jika tidak tersedia: fallback ke web file input + upload flow existing.
- `pick_media` dipertahankan untuk backward compatibility dan kasus non-task upload.
