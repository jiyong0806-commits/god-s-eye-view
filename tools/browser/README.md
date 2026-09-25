# Browser Execution Boundary

Stagehand and open-browser-use were reviewed, not silently enabled.
The God Flow MVP has Input, Search, AI and Output nodes. Browser actions require
an isolated server runner before they can become another executable node type.

- Prefer one Stagehand runner; do not install a second autonomous browser engine in the client.
- No browser cookies, filesystem mounts, shell commands or provider keys in workflow JSON.
- Per-run ephemeral browser context; allowlisted public hosts; deny loopback, private IPs,
  redirects to private networks and cloud metadata. Enforce this at the network layer too.
- Page content is untrusted input, never permission to invoke additional tools.
- Maximum one browser session per user; close on cancel, timeout and process termination.
- Writes, submissions, account changes and downloads require an explicit approval boundary.
- open-browser-use is a separately deployed Python option, not a client dependency.

Sources: https://github.com/browserbase/stagehand and
https://github.com/open-browser-use/open-browser-use .
