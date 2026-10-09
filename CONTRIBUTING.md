# Development workflow

This repository uses trunk-based development with short-lived pull-request branches. `main` is the active integration branch and the source for releases.

## Make a change

Start from the latest `main` with a clean working tree:

```sh
git fetch origin
git switch -c codex/update-controller-tests origin/main
```

Choose a branch name that describes the change. Keep the scope small and integrate frequently, normally within a day or two. Split larger work into independently working changes so `main` remains usable.

Run the relevant checks before opening a pull request:

```sh
npm run test:c
npm test
```

See [build and test](docs/testing.md) for dependencies, static analysis, C coverage, and MATLAB verification. Changes to the controller, model, or numerical interface also need the corresponding boundary, coverage, and model/C checks. Retain selected evidence in `reports/`; generated build files stay ignored.

## Review and integrate

- Open pull requests against `main`.
- Review the diff and verification results before merging. Outside reviews are welcome, but no approval from another person is required for this solo-maintained continuation.
- Wait for **Required CI** to pass. It requires successful static analysis, C unit tests, JavaScript/C verification with controller coverage, and simulator session tests. Update the branch if `main` has changed and rerun the checks.
- Prefer a squash merge, then delete the merged branch. Start the next change from the updated `main`.

The branch rules are configured in GitHub. Existing administrator bypass permissions are reserved for recovery; they are not the normal review path. A local commit or green local tests do not replace the pull request and its required CI check.

## Releases and fixes

Release a tested commit from `main` using a version tag such as `v2.2.0`. Keep the package version, lockfile version, and release notes consistent before tagging. Publishing a release is a separate action from merging a pull request.

Urgent fixes follow the same short-lived branch, review, and CI path. There is no ongoing `develop` integration branch or routine `release/*`/`hotfix/*` merge cycle. Existing Gitflow references and release tags record the project's history; new work starts from `main`.

## References

- [Short-lived branches in trunk-based development](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- [GitHub required status checks](https://docs.github.com/en/pull-requests/reference/status-checks)
