# World Connect V0.1

- God View map: separate right-side panel, USGS earthquake click and recent-event selector.
- Immediate known summary and original USGS link; asynchronous related-event lookup.
- Depth 1 graph: up to 5 events within 500 km and 24 hours, LOCATION only.
- No causal, aftershock, loss, confidence-percentage or second-disaster predictions.
- Single-source reports are not marked independently confirmed. All inference stays labeled.
- Map remains interactive; close/change cancels pending UI requests. Feed requests coalesce and cache for 60 seconds; no frame-loop analysis.
- Local questions use server-verified feed records through Ollama's loopback backend. Configure OLLAMA_MODEL, then run Vite locally. Ollama must already be installed and serving on 127.0.0.1:11434.
- Public Cloudflare has no model attached. Questions return an explicit model-unavailable status; no silent simulated AI. Do not expose Ollama's unauthenticated port to the Internet.

## Daily map service check

Supabase refresh-map-source and pg_cron run at 01:10 Asia/Seoul. The first run returned HTTP 200 and persisted Esri service metadata. The public map-source status API reads only RLS-protected metadata with a publishable key. It never contains a service-role key.

This is service-health verification, not daily imagery acquisition. Esri publishes imagery on its own schedule. No bulk scraping or map redistribution is performed. Esri imagery max level is capped at 19 to avoid observed empty high-zoom placeholder tiles; coverage can still vary by region.

## Remaining

Multi-source corroboration, depth 2/3, event economics, timeline, conflict/correction history and non-earthquake event adapters are not complete. God Flow's public fallback is evidence extraction, not AI inference. Persistent AIS backend and provider permissions remain separate prerequisites.

## Verification

- Supabase initial refresh: HTTP 200, recorded 2026-09-27T02:17:01.035Z. Cron active; security advisors reported no notices.
- Public APIs: Korean school search, source status, event list and analysis returned HTTP 200; one selected event returned 5 actual spatial relations.
- Public God Flow graph: stages 1-4 completed against real search results, with stages 3/4 explicitly labeled non-AI evidence extraction.
- Desktop 1440x900 and narrow 393x852 browser checks passed panel opening/closing, source display, bounds and no WebGL context loss / JavaScript errors. These are short functional checks, not a 10-minute stress/FPS certification.
- Public security smoke: 16 bounded checks passed. This is not a penetration-test certification.
- Ollama 0.34.4 and qwen3:1.7b installed locally. First full prompt timed out at 85 seconds on CPU; compact evidence / 128-token cap returned HTTP 200 in 44 seconds. Model incorrectly asserted an aftershock relationship; a conservative output guard now replaces causal/damage/prediction mentions with source facts and labels the result evidence-only. This guard is not comprehensive fact verification of all possible model output.
- Model is bound to loopback only. Public site cannot reach this PC's model and reports that limitation.
