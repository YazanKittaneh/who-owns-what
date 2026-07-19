# Purging committed PII from git history (issue #6)

The commit removing `data/exports/**/*.csv` and
`data/Property Export 2436+N+Albany+Prospecting.xlsx` from tracking stops the
files from appearing in future checkouts, but they remain retrievable from git
history. Because a history rewrite force-pushes every branch, it has to be run
deliberately by the repo owner — do it at a quiet moment, then re-clone
everywhere.

## Steps

```bash
# 1. Fresh mirror clone (filter-repo refuses to run on a dirty working clone)
git clone --mirror https://github.com/YazanKittaneh/who-owns-what.git wow-mirror
cd wow-mirror

# 2. Install git-filter-repo (https://github.com/newren/git-filter-repo)
pip install git-filter-repo

# 3. Strip the PII paths from all history
git filter-repo \
  --invert-paths \
  --path 'data/Property Export 2436+N+Albany+Prospecting.xlsx' \
  --path-glob 'data/exports/nearby-owner-outreach/*/*.csv'

# 4. Force-push the rewritten history (this rewrites ALL branches and tags)
git push --force --all
git push --force --tags

# 5. Re-clone every working copy; old clones still contain the PII objects.
```

## Afterwards

- Old commit SHAs change; open PR branches need rebasing onto the rewritten
  history.
- GitHub may retain unreachable objects for a while; contact GitHub Support to
  run garbage collection if the repo is ever made public, or (simplest, if
  acceptable) delete and re-create the repo from the cleaned mirror.
- Verify with: `git log --all --oneline -- 'data/exports/**' | wc -l` → 0
  (except the removal/README commits) and
  `git rev-list --all --objects | grep -i 'nearby-owner-contacts'` → empty.
