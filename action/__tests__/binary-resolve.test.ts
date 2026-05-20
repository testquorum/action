import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as fs from "node:fs";
import * as os from "node:os";
import { resolveBinary } from "../binary-resolve.js";

vi.mock("@actions/core");
vi.mock("@actions/exec");
vi.mock("@actions/tool-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@actions/tool-cache")>();
  return {
    ...actual,
    downloadTool: vi.fn(),
  };
});
vi.mock("node:os");
vi.mock("node:fs");

const baseUrl = "https://assets.example.com/binaries/testquorum-runner/";
const version = "abc123";

describe("resolveBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(core.info).mockImplementation(() => {});
    vi.mocked(os.machine).mockReturnValue("x86_64");
    vi.mocked(os.type).mockReturnValue("Linux");
    vi.mocked(fs.chmodSync).mockImplementation(() => {});
  });

  it("downloads and decompresses when the artifact is available", async () => {
    vi.mocked(tc.downloadTool).mockResolvedValue(
      "/tmp/dl/testquorum-runner-x86_64.zst",
    );
    vi.mocked(exec.exec).mockResolvedValue(0);

    const result = await resolveBinary({
      baseUrl,
      version,
      flakeRef: undefined,
    });
    expect(result).toBe("/tmp/dl/testquorum-runner");
    expect(tc.downloadTool).toHaveBeenCalledWith(
      `${baseUrl}${version}/testquorum-runner-x86_64.zst`,
    );
  });

  it("falls back to nix build when 404 and flakeRef is provided", async () => {
    vi.mocked(tc.downloadTool).mockRejectedValue(new tc.HTTPError(404));
    vi.mocked(exec.exec).mockImplementation(
      (async (
        _cmd: string,
        _args?: string[],
        opts?: { listeners?: { stdout?: (b: Buffer) => void } },
      ) => {
        opts?.listeners?.stdout?.(Buffer.from("/nix/store/aaa-testquorum\n"));
        return 0;
      }) as unknown as typeof exec.exec,
    );

    const result = await resolveBinary({
      baseUrl,
      version,
      flakeRef: ".",
    });
    expect(result).toBe("/nix/store/aaa-testquorum/bin/testquorum-runner");
    expect(exec.exec).toHaveBeenCalledWith(
      "nix",
      [
        "build",
        "--no-link",
        "--no-write-lock-file",
        "--print-out-paths",
        ".",
      ],
      expect.any(Object),
    );
  });

  it("raises a clear error when 404 and no flakeRef is provided", async () => {
    vi.mocked(tc.downloadTool).mockRejectedValue(new tc.HTTPError(404));

    await expect(
      resolveBinary({ baseUrl, version, flakeRef: undefined }),
    ).rejects.toThrow(/binary not published at version abc123/);
  });

  it("rethrows non-404 errors instead of falling back", async () => {
    vi.mocked(tc.downloadTool).mockRejectedValue(new tc.HTTPError(500));

    await expect(
      resolveBinary({ baseUrl, version, flakeRef: "." }),
    ).rejects.toBeInstanceOf(tc.HTTPError);
    expect(exec.exec).not.toHaveBeenCalled();
  });
});
