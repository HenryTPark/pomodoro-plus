<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git workflow (always)

For EVERY change, regardless of size, follow this workflow:

1. Decide new work vs. revision:
   - New work (on `master`, or a fresh feature/fix request): create a new branch.
   - Revision (already on a feature branch whose PR is being iterated on): stay on that branch.
2. New branch: `git fetch origin` then `git checkout -b <type>/<short-kebab-desc> origin/master` so it cuts from the latest `master`.
3. Branch/commit `<type>` is one of: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `style` (Conventional Commits).
4. Make the changes.
5. Commit with a Conventional Commit message: `<type>: <summary>`.
6. Push: first push uses `git push -u origin HEAD`.
7. New work: open a PR with `gh pr create` targeting `master`.
   Revision: just push to the existing branch — the open PR updates automatically. Do NOT open a second PR.
