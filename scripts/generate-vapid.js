// Generate VAPID keys for Web Push
// Usage:
//   npm run webpush:vapid
// Then copy keys into your .env:
//   WEBPUSH_VAPID_PUBLIC_KEY=...
//   WEBPUSH_VAPID_PRIVATE_KEY=...
//   WEBPUSH_SUBJECT=mailto:you@example.com
//
// NOTE: Keep the PRIVATE key secret.
const webPush = require("web-push");

const keys = webPush.generateVAPIDKeys();
console.log("WEBPUSH_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("WEBPUSH_VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("WEBPUSH_SUBJECT=mailto:admin@siymon.unaux.com");

