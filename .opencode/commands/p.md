---
description: Review, commit, and push current changes
---
Review the current git working tree and start the commit-and-push workflow for this repository.

1. Run `git status --short --branch`, `git diff`, and `git log -5 --oneline` to understand pending changes and recent commit style.
2. Identify the changes that should be committed, and leave unrelated modifications out unless the user explicitly asks for them.
3. Draft a concise commit message that matches the repository's style.
4. Stage the relevant files, create the commit, and verify the result with `git status`.
5. Push the current branch to its tracked remote.
6. Report the commit hash, branch, and push result.

If there are no relevant changes to commit or there is ambiguity about what should be included, stop and ask one short clarifying question.
