# Provider and repository audit

Checked 2026-09-19. This is an integration decision record, not a claim that every feed is live. A GitHub repository's software license does not grant a license to its upstream maps, imagery, real-time feeds, or personal data.

## Why Sites lost aircraft and satellites

The local Vite process implements many `/api/*` routes. The previous Sites release uploaded only static files. Its browser fetch shim and service worker intercepted those paths and supplied empty fallback payloads. The public Site also has zero runtime environment variables. Consequently, OpenSky OAuth, AIS and other keyed feeds available locally cannot authenticate there. The current changes remove those two interceptors and add a Sites Worker for selected live routes. A provider outage or missing credential now remains an error, not a fictitious live marker.

The production Worker and local Vite backend still have different route coverage. Do not mark a layer as restored until its production route and live data are verified. CelesTrak TLEs need a two-hour shared cache. OpenSky's current terms require a written license for an operational REST integration, so the Worker leaves it off unless `GEV_OPENSKY_LICENSED=1` is deliberately configured after permission is obtained. The ADS-B regional feed is a separate ODbL 1.0 provider with attribution and data-sharing obligations.

Live check on this development host: ADS-B returned HTTP 403 with the generic default User-Agent and HTTP 200 with the public Site URL as identification. CelesTrak returned HTTP 403 even with that URL. SatNOGS DB returned 1,678 TLE records and is now the credited fallback. The first Worker deployment still returned 503 for aircraft and 502 for satellites, so neither layer should be called restored before the next live check. Korean Nominatim geocoding returned HTTP 200.

## Environment inventory

Only `work/gods-eye-view-official/.env` is the active local runtime file. It is ignored by Git. `.env.example` is a non-secret template. The sibling `gods-eye-view-main/.env` and `outputs/.env.example` are old, separate copies; do not merge or delete them automatically. `C:/Users/shin2/.codex/.sandbox/.env` contains only `ELEVENLABS_API_KEY`, not the other provider keys. The active `.env` has 37 distinct names, no duplicate or malformed assignment lines, and 7 empty entries. Some non-secret CCTV settings have inline comments that dotenv can parse, but other loaders may not.

Active `.env` status by name only:

| Provider | Key status | Local implementation | Production requirement |
| --- | --- | --- | --- |
| OpenSky | client ID and secret empty | Vite OAuth / anonymous fallback | Written operational-use license, then Worker secrets |
| AISStream | key empty | Vite WebSocket | Server-side streaming service; a request Worker alone is insufficient |
| TomTom | key set; official geocode test HTTP 200 | Vite traffic proxy | Worker route, rate budget, server secret |
| NASA FIRMS | key set; official status returned transaction fields | Vite fire proxy | Worker route and server secret |
| Google Maps | key empty | Geocode, places, Street View, optional 3D tiles | Restricted browser key and enabled billing/API |
| Cesium ion | token empty | Optional ion imagery/terrain | Restricted token with asset grants |
| ElevenLabs | active file missing; sandbox key returned HTTP 401 on official account-status check | TTS route | Replace invalid key, add Voice ID, server secret and persistent daily quota |
| OpenRouter / OpenAI | empty | Vite AI routes | Secret and spend controls; local voice commands still run without AI |
| Launch Library 2 | optional token missing | Vite launch proxy | Check provider limits |

Sites has **no configured runtime variables** as of this audit. A local `.env` is not automatically copied to Sites. Never commit keys or place server credentials in `VITE_*` values. Credentials previously pasted into chat should be rotated before public deployment.

## Official account and API pages

| Service | Official entry point |
| --- | --- |
| OpenSky | https://opensky-network.org/ and https://dev.opensky-network.org/ |
| AISStream | https://aisstream.io/ |
| NASA FIRMS map key | https://firms.modaps.eosdis.nasa.gov/api/map_key/ |
| TomTom developer | https://developer.tomtom.com/ |
| Google Maps Platform | https://console.cloud.google.com/google/maps-apis/overview |
| Cesium ion | https://ion.cesium.com/ |
| ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| OpenRouter | https://openrouter.ai/settings/keys |
| Launch Library 2 | https://thespacedevs.com/llapi |
| MapTiler | https://cloud.maptiler.com/account/keys/ |

Keyless or separately licensed feeds in the code include CelesTrak, USGS earthquakes, Open-Meteo, OSM Overpass/Nominatim/OSRM, GBFS bike-share, TfL and regional public CCTV catalogs, Radio Browser, GDACS, GDELT and ADS-B feeds. Their service policies, attribution, coverage and uptime still need per-provider review. The public Nominatim server is limited to 1 request/second across the entire application; a growing commercial product needs a dedicated geocoder. RainViewer's public API is intended for personal, educational and small community use; commercial-scale use needs separate terms.

## GitHub repositories reviewed

README and root LICENSE paths were checked for all unique supplied repositories. A missing root LICENSE is not proof that the repo has no license; inspect its documented license before copying code. Do not install a second map or rendering engine merely because a repository exists.

| Repository | Decision for this Cesium app |
| --- | --- |
| [CesiumJS](https://github.com/CesiumGS/cesium) | Already used; keep as globe and 3D Tiles renderer. |
| [deck.gl](https://github.com/visgl/deck.gl) | Candidate for a measured, large-data overlay only; adds GPU and bundle cost. |
| [Three.js](https://github.com/mrdoob/three.js) | Use only for custom assets not supported by Cesium, not a second globe. |
| [Turf](https://github.com/Turfjs/turf) | Candidate for bounded, lazy-loaded disaster geometry calculations. |
| [Supabase](https://github.com/supabase/supabase) | Auth/database option, not a map layer; requires deployment and RLS design. |
| [MapTiler SDK](https://github.com/maptiler/maptiler-sdk-js) | Alternative MapLibre map stack; do not run in parallel with Cesium by default. Tiles/API have separate terms. |
| [liquidglass](https://github.com/ybouane/liquidglass) | Shader effect is too costly over the 3D map; use lightweight CSS glass already present. License needs confirmation. |
| [ComfyUI Audio Waveform Visualizer](https://github.com/kaushiknishchay/ComfyUI-Audio-Waveform-Visualizer) | ComfyUI workflow nodes, not a browser microphone UI. |
| [Coqui TTS](https://github.com/coqui-ai/TTS) | Heavy Python inference service, unsuitable for this lightweight browser bundle. Model licenses differ from code. |
| [rail-radar](https://github.com/R4ULtv/rail-radar) | Useful reference for agency-specific rail coverage; station arrivals are not universal live train coordinates. Do not copy third-party feeds without terms review. |
| [cesiumjs-with-threejs](https://github.com/leon-juenemann/cesiumjs-with-threejs) | Integration example only; another render loop would worsen heat. |
| [three-loader-3dtiles](https://github.com/nytimes/three-loader-3dtiles) | Redundant while Cesium already loads 3D Tiles. |
| [esri-leaflet](https://github.com/Esri/esri-leaflet) | Leaflet adapter, not Cesium; no direct benefit. |
| [amber-alerts](https://github.com/mkimbo/amber-alerts) | User-generated missing-person app, not an authoritative global Amber Alert feed. Do not ingest unverified personal records. |
| [OSRM backend](https://github.com/Project-OSRM/osrm-backend) | Viable dedicated routing server for OSM navigation, not a client package. |
| [Leaflet.Rainviewer](https://github.com/mwasil/Leaflet.Rainviewer) | Leaflet-only UI; RainViewer data use needs separate commercial permission. |
| [maplibre-arcgis](https://github.com/Esri/maplibre-arcgis) | Relevant only to a future separate MapLibre navigation view. ArcGIS services have separate terms. |
| [Tabler Icons](https://github.com/tabler/tabler-icons) | Candidate for a small tree-shaken icon subset; do not import entire collection. |
| [disaster-pulse](https://github.com/denyherianto/disaster-pulse) | Indonesia-focused product reference, not a validated global disaster feed. |
| [disaster-media-api](https://github.com/easc01/disaster-media-api) | Social-media collector; rights, misinformation and moderation risks. Do not treat it as emergency evidence. |
| [AG-UI](https://github.com/ag-ui-protocol/ag-ui) | Optional event protocol if a true agent backend is added; unnecessary for local voice commands. |

`maptiler/maptiler-sdk-js` appeared twice in the request and is counted once. Priorities: repair the existing Cesium backend and source attribution, then pilot Turf for a bounded risk-analysis module and an agency-specific rail feed. A true second-order disaster prediction requires authoritative hazard models, terrain and uncertainty bounds; a slope circle alone must never be labelled a safety forecast.

## Integration risk and next action

Risk is for integrating each project into this existing Cesium product, not a judgment of repository quality. Low = small compatible surface; medium = bounded dependency or service work; high = duplicate rendering stack, uncertain feed rights, operational costs, or unverified safety claims.

| Repository | Risk | Safe path |
| --- | --- | --- |
| CesiumJS | Low | Keep current renderer; profile memory before upgrading. |
| deck.gl | High | Benchmark one isolated large-point overlay before considering installation. |
| Three.js | High | Use an exported asset only if Cesium cannot render it natively. |
| Turf | Medium | Lazy-load a small geometry operation with input limits and tests. |
| Supabase | Medium | Create a project, configure Auth, verify RLS, then gate UI and protected API routes. No project is currently connected. |
| MapTiler SDK | High | Separate navigation view only; compare tile license and memory budget. |
| liquidglass | High | Keep CSS glass; shader over a live globe risks frame rate. |
| ComfyUI Audio Waveform Visualizer | High | Offline animation reference only, not a browser dependency. |
| Coqui TTS | High | Dedicated inference service and model-license review, never bundle in browser. |
| rail-radar | Medium | Verify one railway authority's public GTFS-RT vehicle feed and rights. |
| cesiumjs-with-threejs | High | Study integration; avoid concurrent render loops. |
| three-loader-3dtiles | High | Skip; Cesium already implements 3D Tiles. |
| esri-leaflet | High | Skip Leaflet adapter in Cesium scene. |
| amber-alerts | High | No personal records until authoritative alert feeds, consent and retention are resolved. |
| OSRM backend | Medium | Dedicated routing service with regional OSM extract, capacity and attribution. |
| Leaflet.Rainviewer | High | Use permitted RainViewer data directly after commercial terms review, not Leaflet plugin. |
| maplibre-arcgis | High | Only in separate MapLibre navigation view with ArcGIS service terms. |
| Tabler Icons | Low | Import specific SVG icons only, keep existing style consistent. |
| disaster-pulse | Medium | Study UI patterns; use authoritative hazard data instead of copied app state. |
| disaster-media-api | High | Hold pending content rights, moderation and verification. |
| AG-UI | Medium | Consider when an authenticated agent backend exists. |

Current verified change: the deployed Worker lacked `/api/gbfs/*` although the Vite backend already implements it. The Worker now has an allowlisted HTTPS GBFS proxy and tests; deployment verification is still required. Flight availability remains blocked by upstream HTTP 429. A 404 from another `/api/*` path means the public Worker has no matching route; it must not be masked as live data.
