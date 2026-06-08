# TestQuorum Runner Action

[`testquorum-runner`](https://github.com/testquorum/testquorum-rs) runs your tests. Any standard framework and we'll run it — open an issue on [`testquorum/testquorum-rs`](https://github.com/testquorum/testquorum-rs) if we don't. You can benefit from using the TestQuorum API to get the most out of your tests; this action thinly wraps the runner for better integration with GitHub Actions.

The action pulls a pinned, statically-linked `testquorum-runner` binary from the TestQuorum CDN, decompresses it, and executes it in the workflow's working directory.

## Usage

```yaml
- uses: actions/checkout@v4
- uses: testquorum/testquorum-action@main
  with:
    token: ${{ secrets.TESTQUORUM_TOKEN }}
```

We recommend tracking `@main` and letting [Renovate](https://docs.renovatebot.com/) pin the action to a SHA — this gives you supply-chain pinning without having to chase release tags. See the [`.github/renovate.json`](./.github/renovate.json) in this repository for an example of how the action itself pins its dependencies.

## Supported runners

- `x86_64-Linux`
- `aarch64-Linux`

Other platforms will fail with an "Unsupported platform" error.

## Inputs

| Name         | Required | Default                       | Description                                                                                                                                            |
| ------------ | -------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `token`      | No       | _(unset)_                     | TestQuorum auth token. Passed to `testquorum-runner` via the `TQ_AUTH_TOKEN` environment variable. Optional, but required to get the most out of TestQuorum — without it, the runner can't talk to the API. If empty or unset, no environment variable is set. |
| `version`    | No       | Version pinned in this action | Override the `testquorum-runner` version. Accepts any version published to the CDN (typically a git SHA from `testquorum-rs`).                                                                                                                                  |
| `flake-ref`  | No       | _(unset)_                     | Nix flake reference to build `testquorum-runner` from if the binary download returns 404. Without this input, a missing binary is a hard error.                                                                                                                 |
| `local_only` | No       | `false`                       | If `true`, runs `testquorum-runner` with `--local` — tests are still executed, but no metadata is sent to TestQuorum. Useful for forks, private branches, or running without a token.                                                                            |

## Examples

### Pin to a specific runner version

```yaml
- uses: testquorum/testquorum-action@main
  with:
    version: b97ecc7d94cfd29c781470fab757d1328f734f36
    token: ${{ secrets.TESTQUORUM_TOKEN }}
```

### Build from source as a fallback

If the pinned binary isn't published to the CDN (for example, when testing an unreleased commit), provide a Nix flake reference to fall back to.

```yaml
- uses: testquorum/testquorum-action@main
  with:
    version: <unreleased-sha>
    flake-ref: github:testquorum/testquorum-rs/<unreleased-sha>
    token: ${{ secrets.TESTQUORUM_TOKEN }}
```

This requires `nix` to be available on the runner.

### Local-only run

```yaml
- uses: testquorum/testquorum-action@main
  with:
    local_only: true
```

## Development

The action is written in TypeScript and bundled into `dist/index.js` with `@vercel/ncc`.

```bash
npm install
npm run lint     # tsc --noEmit
npm test         # vitest
npm run build    # rebuild dist/
```

`dist/` is checked in and must be committed alongside any source change.

## License

[MIT](./LICENSE)
