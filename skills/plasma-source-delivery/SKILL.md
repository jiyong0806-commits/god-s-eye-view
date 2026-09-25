---
name: plasma-source-delivery
description: Deliver editable application source with code changes, including GitHub-ready files, Cloudflare deployment configuration, and project-owned plugin integrations. Apply to PLASMA, God View, God Flow, and the user's other code deliverables; not to explanation-only requests.
---

# Source Delivery By Default

After implementing a requested code change, include the corresponding editable source and a concise verification record. Do not substitute an executable, screenshot, hosted URL, or prose claim for source. Respect the latest requested scope; source-first requests take precedence over new feature work.

## Source Package

- Reuse the repository's existing export/build conventions. Include source, dependency lockfiles, configuration, tests, licenses, and build instructions. For God View, use `scripts/export-source.mjs --name <new-delivery-name>` and inspect its manifest.
- Never overwrite an earlier delivery silently. Use a new output directory; include file hashes when an exporter supports them.
- Exclude real `.env` files, tokens, signing keys, credentials, Git history, dependencies, caches and logs. Include sanitized environment variable examples only. Check both source and frontend build output without printing secret values. A heuristic scan is not proof that no unknown credential exists.
- Include existing unfinished modules when providing the full working source, but explicitly identify them as unfinished. Separate external repository reference archives from integrated application code.
- Preserve upstream authorship and licenses. Do not describe a derivative project as independently authored from scratch. Check rights before publishing user-provided media.

## GitHub

- Discover the authenticated account and the exact destination repository. Confirm its visibility, ownership/write access and current branch before uploading. A local `origin` may be the upstream author's repository, not the user's.
- Reuse the verified user repository. Do not force push, replace unrelated files, change visibility or publish secrets. If history may contain secrets, prepare a clean source export rather than publishing that history.
- Supply repository-ready code, `.gitignore`, build instructions and relevant workflows by default. Actual push/PR/publication requires authorization in the current task or a still-applicable explicit project instruction; creating this skill alone does not authorize external changes.
- After a push, verify the remote commit and report the repository/branch link. Do not label local commits as uploaded. Attach any created PR through the app's artifact tool when available.

## Cloudflare

- Preserve the selected platform and renderer. For a Workers app, include the Worker entry point, `wrangler.jsonc`, web source, build scripts, lockfile, migrations and a secret-name checklist.
- A whole source folder is for Git-connected builds or the Wrangler CLI. Static drag-and-drop upload does not deploy the API Worker. Document the correct build command, deploy command, root and generated assets directory.
- Keep environment-specific account IDs, domains and database bindings configurable. Do not fabricate these values or add paid services. Configure API keys through server-side Secrets, never through frontend build variables.
- Use a dry-run when feasible; record the exact result. A dry-run is not a production deployment. Deploy only to an authorized target; verify public page and API responses before claiming it is live.

## Plugin Integration Source

Include project-owned adapters, MCP servers, interface schemas, relevant tests and setup instructions. Third-party plugins' private implementation is not ours to provide. Link to their official source or installation instructions where appropriate. Do not add unused plugin wrappers solely to fill a deliverable checklist.

## Handoff

Provide clickable source-folder/archive links and the GitHub link when verified. State what changed, which tests/builds actually passed, what remains blocked, and whether Cloudflare is configured, dry-run verified, or deployed. Give the most urgent next fix briefly. Do not call unfinished provider integrations, signed native builds, advertising approval or payment activation complete.
