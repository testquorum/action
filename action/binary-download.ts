import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * True when the error came from `tc.downloadTool` for a URL that returned 404.
 * Used by callers to distinguish "version not published" from a transient failure.
 */
export function is404Error(err: unknown): boolean {
  return err instanceof tc.HTTPError && err.httpStatusCode === 404;
}

export function detectArch(): string {
  const arch = os.machine();
  const sys = os.type();

  if ((arch === "x86_64" || arch === "aarch64") && sys === "Linux") {
    return arch;
  }

  throw new Error(
    `Unsupported platform: ${arch}-${sys}. Supported: x86_64-Linux, aarch64-Linux`,
  );
}

/**
 * Download a zstd-compressed static binary from the assets CDN.
 *
 * URL convention: {baseUrl}{version}/testquorum-runner-{arch}.zst
 */
export async function fetchArtifact(
  arch: string,
  version: string,
  baseUrl: string,
): Promise<string> {
  const artifactName = `testquorum-runner-${arch}.zst`;
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const url = `${base}${version}/${artifactName}`;
  core.info(`Downloading artifact from ${url}`);
  const downloadPath = await tc.downloadTool(url);
  core.info(`Downloaded artifact to ${downloadPath}`);
  return downloadPath;
}

/**
 * Decompress the downloaded `.zst` archive into an executable file.
 *
 * Writes the decompressed binary alongside the artifact (no shelling out for
 * file moves) and marks it executable. Returns the absolute path to the
 * resulting binary.
 */
export async function decompressBinary(
  artifactPath: string,
  binName: string,
): Promise<string> {
  const outDir = path.dirname(artifactPath);
  const outPath = path.join(outDir, binName);
  core.info(`Decompressing ${artifactPath} -> ${outPath}`);

  await exec.exec(
    "zstd",
    ["-d", "--force", "--no-progress", "-o", outPath, artifactPath],
  );
  fs.chmodSync(outPath, 0o755);
  return outPath;
}
