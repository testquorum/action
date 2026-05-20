import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "node:path";
import {
  decompressBinary,
  detectArch,
  fetchArtifact,
  is404Error,
} from "./binary-download.js";

export interface ResolveBinaryOptions {
  baseUrl: string;
  version: string;
  flakeRef: string | undefined;
}

const BIN_NAME = "testquorum-runner";

async function buildFromFlake(flakeRef: string): Promise<string> {
  core.info(`Building testquorum-runner from flake ${flakeRef}`);
  let storePath = "";
  await exec.exec(
    "nix",
    [
      "build",
      "--no-link",
      "--no-write-lock-file",
      "--print-out-paths",
      flakeRef,
    ],
    {
      listeners: {
        stdout: (data: Buffer) => {
          storePath += data.toString();
        },
      },
    },
  );
  return path.join(storePath.trim(), "bin", BIN_NAME);
}

export async function resolveBinary(
  opts: ResolveBinaryOptions,
): Promise<string> {
  const arch = detectArch();
  core.info(`Detected arch: ${arch}`);
  try {
    const artifactPath = await fetchArtifact(arch, opts.version, opts.baseUrl);
    return await decompressBinary(artifactPath, BIN_NAME);
  } catch (error) {
    if (!is404Error(error)) throw error;
    if (!opts.flakeRef) {
      throw new Error(
        `testquorum-action: binary not published at version ${opts.version}. ` +
          `Set the 'flake-ref' input to build from source as a fallback.`,
      );
    }
    return buildFromFlake(opts.flakeRef);
  }
}
