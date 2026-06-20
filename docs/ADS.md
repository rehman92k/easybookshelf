# Ads setup

EasyBookshelf uses different Google ad products per platform:

| Platform | Product | When |
|----------|---------|------|
| Web reader (`apps/web-reader`) | **Google AdSense** | Now (M14) |
| Mobile app (Phase 2) | **Google AdMob** | Later |

Ad-free subscribers (`/subscription`) do not see ads on any placement.

## Web — AdSense

1. Apply at [Google AdSense](https://www.google.com/adsense/) and add your site.
2. Create ad units for each placement (display / responsive).
3. Copy values into `apps/web-reader/.env.local`:

```env
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
NEXT_PUBLIC_ADSENSE_SLOT_HOME=1234567890
NEXT_PUBLIC_ADSENSE_SLOT_BROWSE=1234567891
NEXT_PUBLIC_ADSENSE_SLOT_BOOK_DETAIL=1234567892
NEXT_PUBLIC_ADSENSE_SLOT_SEARCH=1234567893
NEXT_PUBLIC_ADSENSE_SLOT_LIBRARY=1234567894
```

4. Restart the reader: `corepack pnpm dev:reader`

Without these env vars, **placeholder ads** appear (dashed box + “Go ad-free” link).

### Placements

| Page | Env slot | Notes |
|------|----------|-------|
| Home | `SLOT_HOME` | Below features |
| Browse | `SLOT_BROWSE` | Above book grid |
| Book detail | `SLOT_BOOK_DETAIL` | Below pricing |
| Search | `SLOT_SEARCH` | Above results |
| Library | `SLOT_LIBRARY` | Footer of library |
| **Reader (popup)** | `SLOT_READER_INTERSTITIAL` | Modal while reading (non-subscribers) |

### In-reader popup (interstitial)

Non-subscribers see a **fullscreen popup** while reading (EPUB/PDF):

- First popup after **90 seconds** (configurable)
- Repeats every **10 minutes** while they keep reading
- **5 second countdown** before “Continue reading” is enabled
- Strong **Subscribe / Go ad-free** CTA
- Optional AdSense unit inside the modal

**Ad-free subscribers never see this.**

Tune timing in `.env.local`:

```env
NEXT_PUBLIC_READER_AD_INITIAL_SECONDS=90
NEXT_PUBLIC_READER_AD_INTERVAL_SECONDS=600
NEXT_PUBLIC_READER_AD_DISMISS_SECONDS=5
```

**No banner ads inside the reader canvas** — only this periodic popup for free users.

## Mobile — AdMob (Phase 2)

Use AdMob app ID and ad unit IDs in the native/React Native app. Reuse the same `adFree` check from `GET /api/v1/subscriptions/me`.

## Disable ads in development

```env
NEXT_PUBLIC_ADS_ENABLED=false
```

Or subscribe to ad-free in local dev to verify the hide logic.
