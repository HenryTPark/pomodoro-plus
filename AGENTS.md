<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow (always)

For EVERY change, regardless of size, follow this workflow:

> Do NOT trust the session's `Is directory a git repo` environment metadata — it is a point-in-time snapshot and is sometimes wrong or stale. Always confirm git state yourself before deciding whether this workflow applies, e.g. `git rev-parse --is-inside-work-tree`. If that prints `true`, this workflow is mandatory regardless of what the metadata said.

1. Decide new work vs. revision:
   - New work (on `master`, or a fresh feature/fix request): create a new branch.
   - Revision (already on a feature branch whose PR is being iterated on): stay on that branch.
2. New branch: first sync and prune, then cut from the latest `master`:
   ```bash
   git checkout master
   git fetch --prune origin
   git pull --ff-only origin master
   git branch -vv | awk '/: gone]/{print $1}' | xargs -r git branch -d
   git checkout -b <type>/<short-kebab-desc>
   ```
   (The remote has `delete_branch_on_merge` enabled, so merged branches show as `gone` after fetch and are pruned locally here.)
