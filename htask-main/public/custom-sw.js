// Custom Service Worker for Push Notifications

// Helper: convert base64 VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Supabase config for SW context
const SUPABASE_URL = 'https://hxbkqbvmyrfggkoybugz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YmtxYnZteXJmZ2drb3lidWd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDQ1ODQsImV4cCI6MjA4NTkyMDU4NH0.aWEsnWOnddpDGlK1UjpBrscAxj900uUpX3QRyRvaSUs';

// Push event handler
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    data = {
      title: 'Hamro Task',
      body: event.data ? event.data.text() : 'You have a new notification'
    };
  }

  const title = data.title || 'Hamro Task';
  const options = {
    body: data.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      url: data.url || '/',
      notificationId: data.notificationId,
      timestamp: Date.now()
    },
    vibrate: [100, 50, 100],
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(() => client.navigate(urlToOpen));
          }
        }
        return clients.openWindow(urlToOpen);
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Future: track dismissal analytics
});

// Handle push subscription change (token rotation, common on iOS)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed, re-subscribing...');

  event.waitUntil(
    (async () => {
      try {
        // Fetch VAPID public key
        const vapidResponse = await fetch(
          `${SUPABASE_URL}/functions/v1/get-vapid-public-key`,
          { headers: { 'apikey': SUPABASE_ANON_KEY } }
        );
        if (!vapidResponse.ok) throw new Error('Failed to fetch VAPID key');
        const { publicKey } = await vapidResponse.json();

        // Re-subscribe with proper VAPID key
        const newSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        // Extract keys
        const p256dhKey = newSubscription.getKey('p256dh');
        const authKey = newSubscription.getKey('auth');
        if (!p256dhKey || !authKey) throw new Error('Missing subscription keys');

        const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
        const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

        // Deactivate old subscription if we have the old endpoint
        const oldEndpoint = event.oldSubscription?.endpoint;
        if (oldEndpoint) {
          await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(oldEndpoint)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ is_active: false }),
          });
        }

        // Upsert new subscription via REST API (no supabase-js in SW)
        await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal,resolution=merge-duplicates',
          },
          body: JSON.stringify({
            endpoint: newSubscription.endpoint,
            p256dh,
            auth,
            is_active: true,
            failed_count: 0,
            last_used_at: new Date().toISOString(),
          }),
        });

        console.log('[SW] Re-subscribed successfully');
      } catch (err) {
        console.error('[SW] Failed to re-subscribe:', err);
      }
    })()
  );
});
