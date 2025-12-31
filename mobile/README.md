# Casa Transit Mobile App

A React Native mobile application for Casablanca public transit, featuring a neo-brutalist design system.

## Features

- 🗺️ Interactive transit map with real-time stop display
- 🚌 Browse bus, tram, busway, and train lines
- 📍 Find nearby stops with distance indicators
- 🛤️ Journey planning with the RAPTOR algorithm
- 🌙 Dark mode support
- 📱 Native haptic feedback
- ♿ WCAG 2.1 AA accessibility compliance

## Tech Stack

- **Framework**: React Native with Expo SDK 54
- **Navigation**: expo-router (file-based routing)
- **Styling**: Custom neo-brutalist theme system
- **Maps**: react-native-maps
- **State**: Zustand + React Query
- **Animations**: React Native Reanimated 4
- **Gestures**: React Native Gesture Handler

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with providers
│   ├── (tabs)/            # Tab navigation
│   │   ├── _layout.tsx    # Tab bar configuration
│   │   ├── index.tsx      # Map screen (default)
│   │   ├── lines.tsx      # Lines explorer
│   │   ├── stops.tsx      # Stops explorer
│   │   └── settings.tsx   # Settings & about
│   ├── line/[id].tsx      # Line detail modal
│   ├── stop/[id].tsx      # Stop detail modal
│   └── journey.tsx        # Journey detail screen
├── assets/                 # Static assets
│   ├── fonts/             # Custom fonts
│   └── README.md          # Asset guidelines
├── src/
│   ├── components/
│   │   ├── feedback/      # Haptic utilities
│   │   ├── map/           # Map components
│   │   ├── planner/       # Journey planner
│   │   └── ui/            # Base UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities & types
│   ├── services/          # API services
│   └── theme/             # Theme system
├── app.json               # Expo configuration
├── package.json           # Dependencies
└── tsconfig.json          # TypeScript config
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app (for development) or Xcode/Android Studio

### Installation

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Start development server
npx expo start
```

### Running on Device

```bash
# iOS Simulator
npx expo run:ios

# Android Emulator
npx expo run:android

# Expo Go (scan QR code)
npx expo start
```

## Troubleshooting

### Worklets mismatch (Reanimated)

If you see an error like:

```
[Worklets] Mismatch between JavaScript part and native part of Worklets (0.7.1 vs 0.5.1)
```

This typically means the JavaScript bundle and the native runtime on your device are out of sync (often because Expo Go is out of date, or you changed dependencies without rebuilding a dev client).

Try in this order:

1) Update Expo Go on your device/simulator (App Store / Play Store), then restart Metro with cache cleared:

```bash
cd mobile
npx expo start -c
```

2) If you're using a custom dev client (or `expo run:android` / `expo run:ios`), rebuild it after dependency changes:

```bash
cd mobile
npx expo prebuild --clean
npx expo run:android
# or
npx expo run:ios
```

3) If it still persists, do a clean reinstall of JS deps and restart:

```bash
cd mobile
rm -rf node_modules
npm install
npx expo start -c
```

Note: The Expo Router warnings about missing `default` exports and “extraneous routes” can appear as a side-effect of this crash, because route modules fail to evaluate.

## Configuration

### API Configuration

For simulators/emulators, the defaults in `src/lib/constants.ts` will work.

For a *physical device* (e.g. iPhone + Expo Go), `localhost` points to your phone, not your computer. Set an Expo public env var to your computer's LAN IP:

```bash
cd mobile

# Replace with your computer's LAN IP (same Wi‑Fi as your phone)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:8080/api/v1 \
  npx expo start --tunnel -c
```

Or use the helper script (Linux/macOS shells):

```bash
cd mobile
npm run start:iphone
```

You can still hardcode the API base URL in `src/lib/constants.ts` if you prefer:

```typescript
export const API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:8080', // Android emulator
  ios: 'http://localhost:8080',
  default: 'http://localhost:8080',
});
```

### Google Maps API

Add your Google Maps API key to `app.json`:

```json
{
  "ios": {
    "config": {
      "googleMapsApiKey": "YOUR_API_KEY"
    }
  },
  "android": {
    "config": {
      "googleMaps": {
        "apiKey": "YOUR_API_KEY"
      }
    }
  }
}
```

## Design System

### Neo-Brutalist Principles

1. **Bold Geometry**: Square shapes, no border radius
2. **Thick Borders**: 2-5px black borders
3. **Offset Shadows**: 3px offset, no blur
4. **Raw Typography**: Space Mono, IBM Plex Mono
5. **High Contrast**: Primary red (#FF0000), accent gold (#FFD700)
6. **Intentional Weight**: Heavy visual presence

### Theme Usage

```tsx
import { useTheme } from '@/theme/ThemeProvider';

function MyComponent() {
  const { theme, isDark, toggleTheme } = useTheme();
  
  return (
    <View style={{
      backgroundColor: theme.colors.background,
      borderWidth: theme.borderWidths.thick,
      borderColor: theme.colors.border,
      ...theme.shadows.md,
    }}>
      <Text style={{
        fontFamily: theme.typography.fonts.heading,
        fontSize: theme.typography.sizes.lg,
        color: theme.colors.foreground,
      }}>
        Brutalist Text
      </Text>
    </View>
  );
}
```

### UI Components

All UI components are brutalist-styled and accessible:

- `Button` - Primary, ghost, muted, destructive, accent variants
- `Badge` - Status indicators
- `Card` - Container with offset shadow
- `Input` - Text input with thick border
- `Select` - Modal picker
- `Tabs` - Tab navigation
- `Accordion` - Expandable sections
- `Switch` - Toggle with sliding animation
- `Skeleton` - Loading placeholder
- `Toast` - Notification banners
- `EmptyState` - Empty data placeholder
- `Chip` / `ChipGroup` - Filter chips
- `ModeIcon` / `LineBadge` - Transport indicators

## Accessibility

- Minimum touch targets: 44x44 points
- Contrast ratio: 4.5:1 minimum
- VoiceOver/TalkBack labels on all interactive elements
- Keyboard navigation support
- Reduced motion preferences respected

## Performance

- FlatList with optimized rendering
- React.memo on list items
- useCallback for event handlers
- Lazy loading of screens
- Reanimated for 60fps animations
- Minimized re-renders with Zustand

## Backend Integration

The app connects to the Go backend API:

- `GET /api/v1/health` - Health check
- `GET /api/v1/lines` - All transit lines
- `GET /api/v1/lines/:id` - Line details
- `GET /api/v1/stops` - Stops in viewport
- `POST /api/v1/route` - Journey planning (RAPTOR)

## Scripts

```bash
# Development
npm start              # Start Expo server
npm run ios           # Run on iOS
npm run android       # Run on Android

# Build
npm run build:ios     # Build for iOS
npm run build:android # Build for Android

# Code Quality
npm run lint          # Run ESLint
npm run typecheck     # TypeScript check
```

## Contributing

1. Follow the neo-brutalist design system
2. Ensure accessibility compliance
3. Add haptic feedback to interactions
4. Optimize for performance
5. Write descriptive commit messages

## License

MIT License - see LICENSE file for details.
