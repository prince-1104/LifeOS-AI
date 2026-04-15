# LifeOS AI — Mobile App

React Native (Expo) mobile app for **LifeOS AI**, synced with the existing FastAPI backend and Next.js web dashboard.

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **AI Chat** | Natural language input → tracks spending, saves memories, sets reminders |
| 📊 **Dashboard** | Income/expense stats, 7-day line chart, category pie chart, activity feed |
| 💰 **Finance** | Full transaction list with income/expense totals and delete |
| 🧠 **Memories** | Stored memories with semantic tags and delete |
| ⏰ **Reminders** | Pending/fired reminders with status indicators and delete |
| 🔐 **Auth** | Clerk sign-in/sign-up with SecureStore token caching |

## Prerequisites

- Node.js 18+
- Expo CLI (`npx expo`)
- An [Expo account](https://expo.dev) (for EAS builds)
- Your **Clerk Publishable Key** (same project as the web frontend)
- Backend running at a reachable IP

## Quick Start

### 1. Install dependencies

```bash
cd mobile
npm install
```

### 2. Configure Clerk

Open `app/_layout.tsx` and replace the placeholder key:

```ts
const CLERK_PUBLISHABLE_KEY = "pk_test_YOUR_ACTUAL_KEY_HERE";
```

> You can find this in your [Clerk Dashboard](https://dashboard.clerk.com) → API Keys.

### 3. Configure API URL

Open `lib/api.ts` and set your backend's reachable IP:

```ts
const API_BASE = "http://YOUR_MACHINE_IP:6060";
```

- For **Android emulator**: use `http://10.0.2.2:6060`
- For **physical device**: use your computer's LAN IP (e.g. `http://192.168.1.100:6060`)
- For **web preview**: `http://localhost:6060` works

### 4. Run the app

```bash
# Web preview
npx expo start --web

# Android (requires emulator or device with Expo Go)
npx expo start --android

# iOS (macOS only)
npx expo start --ios
```

## Building an APK (EAS)

### 1. Login to your Expo account

```bash
npx eas-cli login
```

### 2. Configure project

```bash
npx eas-cli build:configure
```

This will update `app.json` with your EAS project ID.

### 3. Build APK

```bash
# Development build (debug APK)
npx eas-cli build --platform android --profile development

# Preview build (release APK, not signed for Store)
npx eas-cli build --platform android --profile preview

# Production build
npx eas-cli build --platform android --profile production
```

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx          # Root layout with ClerkProvider + AuthGate
│   ├── +not-found.tsx       # 404 page
│   ├── (auth)/
│   │   ├── _layout.tsx      # Auth stack layout
│   │   ├── sign-in.tsx      # Email/password sign-in
│   │   └── sign-up.tsx      # Sign-up with email verification
│   └── (tabs)/
│       ├── _layout.tsx      # Bottom tab bar (5 tabs)
│       ├── chat.tsx         # AI Chat (main screen)
│       ├── dashboard.tsx    # Financial dashboard + charts
│       ├── finance.tsx      # Transaction list
│       ├── memories.tsx     # Memories list  
│       └── reminders.tsx    # Reminders list
├── lib/
│   └── api.ts               # API client (same endpoints as web)
├── constants/
│   └── Theme.ts             # Design tokens matching web theme
├── app.json                 # Expo config
├── eas.json                 # EAS Build config
└── package.json
```

## Design

The app uses the **exact same dark theme** as the web dashboard:
- Background: `#0a0a0a` / `#111111` / `#1a1a1a`
- Accent: `#6366f1` (indigo)
- Glass panels with `rgba(255,255,255,0.06)` borders
- Animated message bubbles, typing indicators, and transitions

## Backend CORS

The backend's CORS config has been updated to include Expo dev server origins:
- `http://localhost:8081` (Metro bundler)
- `http://localhost:19006` (Expo web classic)

> Note: Native mobile apps (Android/iOS) don't send Origin headers, so CORS doesn't apply to them. These origins are only needed for Expo web preview.
