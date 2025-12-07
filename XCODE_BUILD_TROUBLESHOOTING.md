# Xcode Archive Build Troubleshooting Guide

## Standard Build Process (When Everything Works)

1. **Pull latest code:**
   ```bash
   cd ~/Desktop/StockFinderAI
   git stash
   git pull origin main
   ```

2. **Start Metro bundler FIRST:**
   ```bash
   npx react-native start --reset-cache
   ```
   ⚠️ **Keep this terminal running throughout the build!**

3. **Open Xcode (in a NEW terminal tab):**
   ```bash
   open ~/Desktop/StockFinderAI/ios/MyReactNativeApp.xcworkspace
   ```
   ⚠️ **Always open .xcworkspace, NOT .xcodeproj**

4. **In Xcode:**
   - Select **"Any iOS Device (arm64)"** from device dropdown
   - **Product → Clean Build Folder** (⇧⌘K)
   - **Product → Archive**

---

## When Build Fails - Quick Clean

Try this first if you get build errors:

```bash
cd ~/Desktop/StockFinderAI
pkill -f "node" || true
pkill -f "react-native" || true

cd ios
rm -rf Pods Podfile.lock build
pod install
cd ..

# Start Metro
npx react-native start --reset-cache
```

Then open Xcode and try archiving again.

---

## When Build Still Fails - Deep Clean

If quick clean doesn't work, do a complete reset:

```bash
cd ~/Desktop/StockFinderAI

# Kill all Node processes
pkill -f "node" || true
pkill -f "react-native" || true

# Remove all build artifacts
rm -rf node_modules
rm -rf ios/Pods
rm -rf ios/Podfile.lock
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Reinstall everything
npm install
cd ios
pod install
cd ..

# Start Metro
npx react-native start --reset-cache
```

**Then in a NEW terminal tab:**
```bash
open ~/Desktop/StockFinderAI/ios/MyReactNativeApp.xcworkspace
```

**In Xcode:**
- Product → Clean Build Folder (⇧⌘K)
- Product → Archive

---

## Common Issues & Solutions

### "Metro bundler not running"
- Make sure Metro terminal is still running
- Don't close Metro until Archive completes

### "No such module" errors
- You opened .xcodeproj instead of .xcworkspace
- Close Xcode and open .xcworkspace

### "Pod install failed"
- Run: `pod deintegrate` then `pod install`
- Check you're in the ios/ directory

### "Signing errors"
- Verify your Apple Developer account is logged in
- Check provisioning profiles are valid

### Archive gets stuck
- Metro might have crashed - check Metro terminal
- Restart Metro and try again

---

## Checklist Before Archive

✅ Latest code pulled from git  
✅ Metro bundler running with --reset-cache  
✅ Metro terminal kept open  
✅ Opened .xcworkspace (not .xcodeproj)  
✅ Selected "Any iOS Device (arm64)"  
✅ Clean Build Folder executed  

---

## Notes

- Always start Metro **before** opening Xcode
- Keep Metro running until Archive completes
- If in doubt, do a deep clean and start fresh
- CocoaPods must be installed: `sudo gem install cocoapods`
