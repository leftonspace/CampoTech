# Deep Links & Universal Links Setup

## Overview

The CampoTech Consumer app supports deep links and universal links to open specific screens directly from external sources (WhatsApp messages, SMS, web links).

## Supported Links

| Link Type | Example URL | Opens Screen |
|-----------|-------------|--------------|
| Provider Profile | `https://campotech.com.ar/provider/abc123` | Provider detail page |
| Rating | `https://campotech.com.ar/rate/xyz789` | Rating form |
| Deep Link (Provider) | `campotech://provider/abc123` | Provider detail page |
| Deep Link (Rating) | `campotech://rate/xyz789` | Rating form |

## Configuration

### iOS (Universal Links)

1. **Associated Domains** are configured in `app.json`:
   ```json
   {
     "ios": {
       "associatedDomains": [
         "applinks:campotech.com.ar",
         "applinks:www.campotech.com.ar"
       ]
     }
   }
   ```

2. **Server-side**: Host an `apple-app-site-association` file at:
   - `https://campotech.com.ar/.well-known/apple-app-site-association`

   File content:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.tech.campo.consumer",
           "paths": [
             "/provider/*",
             "/rate/*"
           ]
         }
       ]
     }
   }
   ```

   Replace `TEAM_ID` with your Apple Developer Team ID.

### Android (App Links)

1. **Intent Filters** are configured in `app.json`:
   ```json
   {
     "android": {
       "intentFilters": [
         {
           "action": "VIEW",
           "autoVerify": true,
           "data": [
             { "scheme": "https", "host": "campotech.com.ar", "pathPrefix": "/provider" },
             { "scheme": "https", "host": "campotech.com.ar", "pathPrefix": "/rate" }
           ],
           "category": ["BROWSABLE", "DEFAULT"]
         }
       ]
     }
   }
   ```

2. **Server-side**: Host an `assetlinks.json` file at:
   - `https://campotech.com.ar/.well-known/assetlinks.json`

   File content:
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "tech.campo.consumer",
         "sha256_cert_fingerprints": [
           "YOUR_SHA256_FINGERPRINT"
         ]
       }
     }
   ]
   ```

   Get your SHA256 fingerprint from EAS:
   ```bash
   eas credentials -p android
   ```

## Web Fallback

When a user clicks a link but doesn't have the app installed:

1. The web server at `campotech.com.ar` should detect the request
2. Show a landing page with:
   - App Store / Play Store download buttons
   - Preview of the content (provider info / rating prompt)

Example fallback page for `/provider/[id]`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ver en CampoTech</title>
  <script>
    // Try to open the app
    window.location = 'campotech://provider/PROVIDER_ID';

    // Fallback to store after delay
    setTimeout(function() {
      var userAgent = navigator.userAgent || navigator.vendor;
      if (/android/i.test(userAgent)) {
        window.location = 'https://play.google.com/store/apps/details?id=tech.campo.consumer';
      } else if (/iPad|iPhone|iPod/.test(userAgent)) {
        window.location = 'https://apps.apple.com/app/campotech/id123456789';
      }
    }, 2000);
  </script>
</head>
<body>
  <h1>Abriendo CampoTech...</h1>
  <p>Si la app no se abre automáticamente, <a href="...">descargala aquí</a></p>
</body>
</html>
```

## Testing

### Test Deep Links in Development

```bash
# iOS Simulator
npx uri-scheme open "campotech://provider/123" --ios

# Android Emulator
npx uri-scheme open "campotech://provider/123" --android

# Or with Expo CLI
npx expo start --dev-client
# Then in terminal: deep-link campotech://provider/123
```

### Test Universal Links

Universal links only work with:
- A published app (TestFlight / internal testing)
- Valid SSL certificate on the domain
- Properly configured `.well-known` files

To test locally, use the deep link scheme (`campotech://`) instead.

## Usage in Code

```typescript
import {
  getProviderShareUrl,
  getRatingUrl,
  handleDeepLink
} from '@/lib/linking';

// Generate shareable URL
const shareUrl = getProviderShareUrl('provider-123');
// Result: https://campotech.com.ar/provider/provider-123

// Generate rating URL (sent via WhatsApp after job completion)
const ratingUrl = getRatingUrl('rating-token-xyz');
// Result: https://campotech.com.ar/rate/rating-token-xyz
```

## WhatsApp Integration

When a job is completed, send the rating link via WhatsApp:

```typescript
const ratingUrl = getRatingUrl(job.ratingToken);
const message = `¡Gracias por elegir ${businessName}!
Calificá tu experiencia: ${ratingUrl}`;

// Send via WhatsApp API
```

The link will:
1. Open the CampoTech app directly (if installed)
2. Show the rating form with the job details
3. Allow the customer to rate without logging in
