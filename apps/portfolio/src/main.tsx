import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';
import App from './App';
import './index.css';

// Deployment-neutral API base URL: relative "/api/..." requests (same-origin)
// when unset, or an absolute origin when the frontend and API are hosted
// separately. This is the one place that reads the env var — nothing else
// in the app should reach for import.meta.env directly for this.
setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);

// A normal browser refresh must always land on the hero, not on whatever
// section an earlier in-page nav click (e.g. #work) left in the URL and the
// browser's own scroll-position memory. Both are reset once here, before
// React mounts, so no section briefly flashes into view first. Normal
// anchor-hash navigation after load (clicking WORK, ABOUT, etc.) is
// untouched — the browser handles that natively.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
if (window.location.hash) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}
window.scrollTo({ top: 0, left: 0, behavior: 'auto' });

createRoot(document.getElementById('root')!).render(<App />);