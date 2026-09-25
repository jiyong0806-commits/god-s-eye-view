# Project Delivery Convention

For code changes in this repository, follow `skills/plasma-source-delivery/SKILL.md`.
Provide editable source, GitHub-ready files, Cloudflare deployment configuration and
project-owned plugin integration source with each delivery. A hosted URL alone is insufficient.
Keep provider keys and signing material out of exports and public commits.

The verified user-owned GitHub destination is `jiyong0806-commits/god-s-eye-view`.
The working checkout's origin may point to the upstream author's repository. Never push
user-specific changes there by assumption. Recheck remotes and remote state before pushing.

Cloudflare is the user's selected deployment direction. A complete source folder must
include both the static frontend and API Worker. Do not describe a static assets upload
as a complete backend deployment. Do not activate billing or purchase a domain implicitly.

The source-delivery preference does not itself authorize future remote publication.
Respect each task's push/deploy authorization and preserve unrelated work.
