# Daily map source check

This backend checks Esri World Imagery service metadata once daily. It does not scrape,
download, store, or rehost satellite tiles. `checked_at` is not an imagery acquisition
date; the source publishes different vintages by location.

The `map_source_checks` table allows public read-only status under RLS. Writes are made
only by the `refresh-map-source` Edge Function with its server-side service key.
The function must be deployed with JWT verification enabled. A `pg_cron` + `pg_net`
job invokes it at 01:10 Korea time (16:10 UTC) using a publishable key stored in
Supabase Vault. The key value is deliberately absent from this repository.

Map imagery itself is loaded directly from Esri by Cesium. Viewer tile cache expiry
and Esri publication timing determine when changed imagery appears. A successful
daily status check must not be presented as new aerial photography.
