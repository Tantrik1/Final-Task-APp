# 12 — PWA & Performance

## PWA Configuration

Hamro Task is a **Progressive Web App** built with `vite-plugin-pwa`:

- **Installable** on mobile (iOS, Android) and desktop
- **Start URL**: `/auth` (ensures login screen on app launch)
- **Display mode**: `standalone` (no browser chrome)
- **Icons**: 192x192, 512x512, maskable variants
- **Theme colors** configured for both light and dark modes

## Service Worker

### Custom SW (`public/custom-sw.js`)

Handles:
- **Push notifications**: Display, click handling, deep-link navigation
- **Push subscription rotation**: Re-subscribes with VAPID key on token change
- **Background sync**: Keeps push subscriptions up-to-date

### Workbox (via vite-plugin-pwa)

- **Precaching**: Critical assets cached on install
- **Runtime caching**: API responses cached with appropriate strategies
- **Offline fallback**: Basic offline page when network unavailable

## Install Prompt (`PWAInstallPrompt.tsx`)

- Detects `beforeinstallprompt` event
- Shows friendly install banner
- Tracks dismissal to avoid repeated prompting
- Uses `usePWAInstall` hook for state management

## Pull to Refresh (`PullToRefresh.tsx`)

- Native-feeling pull-down gesture on mobile
- Triggers page data refresh
- Smooth animation with loading indicator

## Performance Optimizations

| Technique | Implementation |
|-----------|---------------|
| Lazy routes | React.lazy + Suspense for all page components |
| Skeleton loaders | Every data-fetching component shows skeletons |
| Image optimization | Lazy loading on images |
| Bundle splitting | Vite code splitting per route |
| Minimal global state | Only workspace + user in context; data fetched per page |
| Scroll restoration | `ScrollToTop` component on route changes |

## Mobile-First Design

- Every screen designed at 375px width first
- Bottom navigation (5 items max) instead of hamburger menu
- Sheets/drawers instead of new pages for secondary actions
- Large tap targets (min h-12)
- Sticky headers and primary action buttons
- `useIsMobile` hook for responsive behavior switching

## For Project Managers

- **Install as an app** on your phone for the best experience — it looks and feels native
- **Push notifications** work even when the app is closed (after installing as PWA)
- **Fast loading** — skeleton loaders prevent blank screens
- **Works offline** — view cached tasks even without internet
