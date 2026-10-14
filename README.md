# Next.js & Cloudinary image gallery

Image gallery with public uploads, admin moderation, and Cloudinary delivery.

## Features

- Public gallery shows only **approved** (and not **hidden**) photos
- Anyone can upload via `/upload` (tagged `pending` until approved)
- Admin panel at `/admin` — approve, reject, pause (hide), republish, delete
- Newest approved photos appear first

## Setup

1. Create a [Cloudinary](https://cloudinary.com) account and create a folder (e.g. `afche`).
2. Copy `.env.local.example` to `.env.local` and set:

```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_FOLDER=
ADMIN_USER=admin
ADMIN_PASSWORD=admin
ADMIN_SESSION_SECRET=
```

3. `npm install && npm run dev`

### Cloudinary upload permission (403)

If upload returns **403 / missing permissions (create)**, your API key cannot create assets.

Fix one of these:

1. **Preferred:** In [Cloudinary Console](https://console.cloudinary.com/) → Settings → API Keys, generate or use a key that has **Upload / create** permission (not read-only).
2. **Or:** Create an **Upload preset** (Settings → Upload → Upload presets), allow folder `afche` and tag `pending`, then set `CLOUDINARY_UPLOAD_PRESET` in `.env.local`.

## Admin

- Login: `/admin/login` (default `admin` / `admin` — change in production)
- Pending uploads appear under the **Pending** tab
- **Approve** publishes to the public gallery
- **Pause** hides a published photo without deleting it
- **Reject** / **Delete** removes the asset from Cloudinary

## Photo tags

| Tag | Meaning |
|-----|---------|
| `pending` | Awaiting moderation |
| `approved` | Visible in the gallery |
| `hidden` | Temporarily unpublished |
| `rejected` | Rejected (usually deleted) |

Existing assets without an `approved` tag will not show in the public gallery until approved (or tagged `approved` in Cloudinary).

## References

- Cloudinary API: https://cloudinary.com/documentation/transformation_reference
- `next/image`: https://nextjs.org/docs/api-reference/next/image
