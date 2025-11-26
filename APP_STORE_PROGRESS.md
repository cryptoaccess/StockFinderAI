# StockFinderAI - App Store Publishing Progress

## Project Status: November 26, 2025

### ✅ COMPLETED

#### Phase 1: Technical Preparation
- [x] Backend deployed to Railway: https://stockfinderai-production.up.railway.app
- [x] API configuration centralized (`src/config/api.ts`)
- [x] Production URL configured
- [x] All TypeScript errors fixed
- [x] Service files updated (CongressTradesService, InsiderTradesService)

#### Phase 2: Legal & Business Setup
- [x] Privacy Policy: https://cryptoaccess.github.io/StockFinderAI/privacy-policy.html
- [x] Terms of Service: https://cryptoaccess.github.io/StockFinderAI/terms-of-service.html
- [x] Landing Page: https://cryptoaccess.github.io/StockFinderAI/
- [x] Support email created: contact.stockfinderai@gmail.com
- [x] GitHub repo made public
- [x] GitHub Pages enabled

---

### ⏳ TODO - Phase 3: App Store Publishing

#### 1. App Assets Needed
**App Icon:**
- [ ] Create 1024x1024px icon
- [ ] Use https://appicon.co/ to generate all sizes

**Screenshots - iOS:**
- [ ] 6.7" iPhone (1290 × 2796px) - 3-5 screenshots
- [ ] 6.5" iPhone (1242 × 2688px) - 3-5 screenshots

**Screenshots - Android:**
- [ ] Phone screenshots (16:9 or 9:16, min 320px)
- [ ] Feature graphic (1024×500px) - required

**Suggested Screenshots:**
1. Home screen with market data
2. Congress Trades screen
3. AI Picks screen
4. Blue Chip Dips screen
5. Watch List screen

#### 2. Developer Accounts (Required)
- [ ] Apple Developer Program: $99/year - https://developer.apple.com/programs/
- [ ] Google Play Console: $25 one-time - https://play.google.com/console/signup

#### 3. iOS App Store Submission
**Build Steps:**
```bash
cd ios
pod install
cd ..
# Open in Xcode: open ios/MyReactNativeApp.xcworkspace
# Product → Archive
# Upload to App Store Connect
```

**App Store Connect:**
- [ ] Create new app at https://appstoreconnect.apple.com
- [ ] App Name: StockFinderAI
- [ ] Category: Finance
- [ ] Keywords: stocks, congress trades, insider trading, stock analysis, investment research
- [ ] Description and screenshots
- [ ] Privacy Policy URL: https://cryptoaccess.github.io/StockFinderAI/privacy-policy.html
- [ ] Terms URL: https://cryptoaccess.github.io/StockFinderAI/terms-of-service.html
- [ ] Support URL: https://cryptoaccess.github.io/StockFinderAI/
- [ ] Submit for review

#### 4. Google Play Store Submission
**Build Steps:**
```bash
# Generate keystore (first time only):
keytool -genkeypair -v -storetype PKCS12 -keystore stockfinderai-upload.keystore -alias stockfinderai -keyalg RSA -keysize 2048 -validity 10000

# Build release:
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

**Play Console:**
- [ ] Create app at https://play.google.com/console
- [ ] App Name: StockFinderAI
- [ ] Category: Finance
- [ ] Store listing with screenshots and feature graphic
- [ ] Privacy Policy: https://cryptoaccess.github.io/StockFinderAI/privacy-policy.html
- [ ] Content rating questionnaire
- [ ] Upload AAB file
- [ ] Submit for review

#### 5. Pre-Launch Testing
- [ ] Test on physical iOS device
- [ ] Test on physical Android device
- [ ] Verify production backend works
- [ ] Test all features:
  - [ ] Congress Trades load
  - [ ] Insider Trades load
  - [ ] AI Picks calculate
  - [ ] Blue Chip Dips filter
  - [ ] Watch List saves/loads
  - [ ] Share button works
  - [ ] Market data displays
  - [ ] All disclaimers visible

---

### App Information (For Submissions)

**Name:** StockFinderAI

**Subtitle:** Congress & Insider Trade Tracker

**Description:**
Track congressional and insider trades, discover AI-powered stock picks, and find blue-chip stocks at discounted prices.

Features:
• Real-time Congress trading activity
• Corporate insider trade tracking
• AI-analyzed stock opportunities
• Blue chip dip detector
• Personal watchlist
• Market index tracking

**Keywords:** stocks, congress trades, insider trading, stock analysis, investment research, financial data, stock tracker

**Category:** Finance

**Age Rating:** 4+ (no objectionable content)

**Support Contact:** contact.stockfinderai@gmail.com

**Developer:** Malachi J. King

---

### Technical Details

**Backend:**
- Server: Railway
- URL: https://stockfinderai-production.up.railway.app
- Endpoints:
  - /api/trades (Congress)
  - /api/insider-trades (Insider)

**API Configuration:**
- Location: `src/config/api.ts`
- Auto-detects dev/production
- Handles iOS/Android platform differences

**Repository:**
- GitHub: https://github.com/cryptoaccess/StockFinderAI
- Status: Public
- Branch: main

---

### Estimated Timeline

- Developer accounts: 1-2 days (approval time)
- Asset creation: 2-3 days
- Build & test: 1-2 days
- App Store review: 1-3 days (iOS)
- Play Store review: Few hours to 1 day (Android)

**Total: 1-2 weeks to go live**

---

### Next Session Checklist

When ready to continue:
1. Register Apple Developer account (if doing iOS)
2. Register Google Play Console account (if doing Android)
3. Create app icon design
4. Take screenshots of app features
5. Build release versions
6. Test on real devices
7. Submit to stores

---

### Important Notes

- All code changes are committed to GitHub
- Backend is live and operational
- Legal documents are published and accessible
- Support email is active: contact.stockfinderai@gmail.com
- App is fully functional in development mode
- Phase 1 & 2 complete - ready for Phase 3 when you are

---

Last Updated: November 26, 2025
