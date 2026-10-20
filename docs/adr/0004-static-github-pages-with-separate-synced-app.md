# Publish a static Pages app and retain the private synced app separately

The user selected a full GitHub Pages app with device-local history and a separate private synced version. Build the existing workout client as static assets, retain browser storage and JSON import/export, and link to the private authenticated app instead of presenting server-only sign-in as a Pages feature. The existing main/root publishing source is retained; all asset and service worker paths use the /day-by-day/ project base, and original browser history is migrated without removing its old storage key.
