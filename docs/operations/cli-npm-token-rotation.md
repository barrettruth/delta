# CLI npm token rotation

Delta publishes the CLI package `@barrettruth/delta` from the Forgejo
`cli-release` workflow. The workflow uses the repository Actions secret
`NPM_TOKEN`; npm does not expose a supported "renew this existing token" path,
so rotation means creating a replacement token, syncing it to Forgejo, then
revoking the old token.

## Current decision

- Keep Forgejo as the release runner for now.
- Treat the SOPS file at
  `~/.config/nix/secrets/vps/forgejo-action-delta-npm-token` as the encrypted
  source of record for the current npm publish token.
- Store public expiry metadata in the Forgejo Actions variable
  `NPM_TOKEN_EXPIRES_AT`.
- Do not automate token creation in CI. That would require storing a stronger
  long-lived npm credential, password, OTP seed, or browser session.

The cleaner long-term alternative is npm trusted publishing, but npm currently
supports GitHub Actions, GitLab CI/CD, and CircleCI cloud for that flow. The
current Forgejo self-hosted runner is still a token-based publisher.

## Rotation runbook

1. Create a replacement npm granular access token for `@barrettruth/delta`.
   Use read/write package access, an explicit expiration date, and only enable
   2FA bypass if npm package settings require it for automation.

   ```sh
   npm token create \
     --name delta-cli-forgejo \
     --expires 30 \
     --packages @barrettruth/delta \
     --packages-and-scopes-permission read-write
   ```

   Add `--bypass-2fa` only if npm package settings require it for automation.
   If npm refuses CLI token creation, create the granular token from npmjs.com.

2. Replace the encrypted SOPS value in the Nix checkout. The JSON shape is:

   ```json
   {
     "data": "npm token value goes here"
   }
   ```

3. From the Delta checkout, sync SOPS into Forgejo and set the expiry metadata:

   ```sh
   nix shell nixpkgs#sops nixpkgs#tea -c \
     env DELTA_NPM_TOKEN_EXPIRES_AT=YYYY-MM-DD \
     scripts/version/sync-npm-token-from-sops.sh
   ```

4. When the version bump PR has merged and the package version is ready to tag,
   run the release command:

   ```sh
   just release cli 0.0.7 --tag
   ```

5. Revoke the old npm token after the new token has published successfully.

## Release preflight

`scripts/version/bump.sh` checks `NPM_TOKEN` before pushing a `cli-v*` tag. It
now also reads `NPM_TOKEN_EXPIRES_AT` and blocks if the token is expired or
within the fail window. If the variable is missing, the script falls back to the
Forgejo secret update time and warns that expiry metadata is missing.

Defaults:

- `DELTA_NPM_TOKEN_EXPIRY_WARN_DAYS=14`
- `DELTA_NPM_TOKEN_EXPIRY_FAIL_DAYS=3`
- `DELTA_NPM_TOKEN_SECRET_WARN_AGE_DAYS=21`
- `DELTA_NPM_TOKEN_SECRET_MAX_AGE_DAYS=28`
