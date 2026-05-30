import * as core from "@actions/core";
import * as exec from "@actions/exec";
import { resolveBinary } from "./binary-resolve.js";
import { PINNED_VERSION } from "./version.js";

const DEFAULT_BASE_URL =
  "https://assets.testquorum.dev/binaries/testquorum-runner/";

async function main(): Promise<void> {
  const version = core.getInput("version") || PINNED_VERSION;
  const flakeRef = core.getInput("flake-ref") || undefined;
  const token = core.getInput("token") || undefined;

  const binPath = await resolveBinary({
    baseUrl: DEFAULT_BASE_URL,
    version,
    flakeRef,
  });
  core.info(`Running ${binPath}`);
  if (token !== undefined) {
    core.setSecret(token);
    process.env.TQ_AUTH_TOKEN = token;
  }
  const exitCode = await exec.exec(binPath, [], { ignoreReturnCode: true });
  if (exitCode !== 0) {
    core.setFailed(`testquorum-runner exited with ${exitCode}`);
  }
}

main().catch((err) => {
  core.setFailed(err instanceof Error ? err.message : String(err));
});
