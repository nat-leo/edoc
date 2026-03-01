# Pair Programming PRs

This is the workflow we're running when working on PRs with either other developers or code bots. The workflow is from the perspective of say of Senior developer working with a junior on some PR. This can be extended to our PR bot.

Here’s the clean, low-drama way to do this when your junior already opened a PR from a branch, and you (senior) want to push fixes onto **that same branch** so the PR updates automatically.

I’ll give you the workflow from your perspective, with both the “best practice” path (you have push access) and the “no push access” path (you don’t).

---

## Scenario A (most common): Junior’s branch is in the same repo and you have push access

### 0) Preconditions (once)

* The PR branch exists on `origin` (same repo) e.g. `feature/login-fix`
* You have permission to push to that branch
* You want your commits to show you as author, and junior as co-author (optional)

---

## 1) Get the latest state locally

```bash
git fetch origin
```

If you don’t have the branch locally yet:

```bash
git switch -c feature/login-fix origin/feature/login-fix
```

If you *do* have it locally already:

```bash
git switch feature/login-fix
git pull --ff-only origin feature/login-fix
```

> Using `--ff-only` avoids accidentally creating a merge commit locally.

---

## 2) Make your edits

Edit files as needed.

Check what changed:

```bash
git status
git diff
```

---

## 3) Commit in a way that preserves co-author credit (recommended)

Stage changes:

```bash
git add -A
```

Commit:

```bash
git commit -m "Fix: handle null redirect + stabilize auth tests

Co-authored-by: Junior Name <junior@company.com>"
```

Notes:

* That `Co-authored-by:` line must be **exactly** formatted and in the commit message body.
* Use the junior’s *GitHub-linked email* if you want GitHub to show it reliably.

If you’re making multiple commits, you can add co-author lines on the commits that are “shared work,” or on all of them—your call.

---

## 4) Push to the same branch (PR auto-updates)

```bash
git push origin HEAD:feature/login-fix
```

Or simply:

```bash
git push
```

(if your local branch tracks the remote branch)

---

## 5) If PR requires updated base / you need to resolve conflicts

### If your team prefers rebase (linear history)

```bash
git fetch origin
git rebase origin/main   # or origin/master
# resolve conflicts
git add -A
git rebase --continue
git push --force-with-lease
```

Use `--force-with-lease` (not plain `--force`) so you don’t accidentally overwrite the junior’s new commits.

### If your team prefers merge commits

```bash
git fetch origin
git merge origin/main
# resolve conflicts
git add -A
git commit
git push
```

---

## 6) If the junior keeps pushing while you’re editing

This is normal. Do this before pushing:

```bash
git fetch origin
git pull --rebase origin feature/login-fix
# or: git pull --ff-only (if no local commits yet)
git push
```

If you hit a rebase conflict, resolve and continue.

---

## 7) Safety checks before you push

```bash
git log --oneline --decorate -10
git diff origin/feature/login-fix...HEAD
```

Run tests locally if that’s expected:

```bash
# whatever your repo uses
npm test
mvn test
pytest
```

---

## Scenario B: You do NOT have permission to push to junior’s branch

You have two realistic options:

### Option B1) Ask junior to add you as a collaborator / grant push perms

Then do Scenario A.

### Option B2) Push fixes via your own branch + PR into their branch (stacked PR)

This is clunkier but works everywhere.

```bash
git fetch origin
git switch -c senior/fix-login origin/feature/login-fix
# make edits
git add -A
git commit -m "Fix: …"
git push -u origin senior/fix-login
```

Then open a PR **targeting the junior branch** (base = `feature/login-fix`, compare = `senior/fix-login`).
Once that merges, the original PR updates.

---

## What I recommend in practice (team-friendly)

* **Prefer Scenario A** (push to the same branch) for speed.
* Use `--ff-only` pulls and `--force-with-lease` if you must rewrite history.
* If you need to do non-trivial changes, leave commits small and message clearly.
* Put co-author line in commits where it’s genuinely shared work; otherwise just push your commits normally.

If you tell me whether your repo uses **“squash merge”** or **“rebase & merge”** (and whether history rewrite is allowed), I’ll tailor the exact commands to match your team policy.
