---
description: How to publish OTA updates to the mobile app
---

# OTA (Over-The-Air) Updates Workflow

This workflow allows you to push JavaScript/asset updates to phones that already have the app installed, **without rebuilding a new APK**.

## When to Use OTA Updates

✅ **Use OTA updates for:**
- Bug fixes in JavaScript code
- UI/layout changes
- Adding new screens (JS only)
- Text/copy changes
- Image/asset updates

❌ **Requires a NEW BUILD instead:**
- Adding new native packages (e.g., new expo-* packages with native code)
- Changing permissions in app.json
- Changing package name, version code, or native config
- Adding/updating native modules

---

## Quick Commands

### Option 1: Use the Script (Recommended)
// turbo
```powershell
cd d:\projects\CampoTech\apps\mobile
.\scripts\publish-update.ps1 -Message "Bug fixes and performance improvements"
```

### Option 2: Direct EAS CLI Command
// turbo
```powershell
cd d:\projects\CampoTech\apps\mobile
npx eas-cli update --channel preview --message "Your update message"
```

---

## Understanding Channels

| Channel | Purpose | Who Gets Updates |
|---------|---------|------------------|
| `preview` | Testing/staging | APKs built with `--profile preview` |
| `production` | Production releases | Apps submitted to Play Store |

Your current APK is on the `preview` channel.

---

## How Users Receive Updates

1. **Default behavior:** Updates are downloaded when the app is opened
2. **Applied on:** Next app restart (cold start)
3. **Automatic:** No user action required

You can customize this behavior in the app code if needed.

---

## Viewing Published Updates

### In Terminal:
// turbo
```powershell
npx eas-cli update:list --channel preview --limit 10
```

### In Expo Dashboard:
1. Go to https://expo.dev
2. Navigate to your project (CampoTech)
3. Click "Over-the-air updates" in the left sidebar
4. Select the "preview" branch to see all published updates

---

## Rollback an Update

If something goes wrong, you can roll back:

```powershell
# List recent updates
npx eas-cli update:list --channel preview --limit 10

# Delete a problematic update (users will get the previous version)
npx eas-cli update:delete --id <UPDATE_ID>
```

---

## Best Practices

1. **Always test locally first** before publishing
2. **Use descriptive messages** for update tracking
3. **Check the Expo dashboard** to verify updates are published
4. **Monitor user feedback** after pushing updates
