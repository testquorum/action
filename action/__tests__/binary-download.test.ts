import { describe, it, expect, vi, beforeEach } from "vitest";
import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as fs from "node:fs";
import * as os from "node:os";
import {
  decompressBinary,
  detectArch,
  fetchArtifact,
  is404Error,
} from "../binary-download.js";

vi.mock("@actions/core");
vi.mock("@actions/exec");
vi.mock("@actions/tool-cache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@actions/tool-cache")>();
  return {
    ...actual,
    downloadTool: vi.fn(async (url: string) => `/tmp/downloaded-${url.length}`),
  };
});
vi.mock("node:os");
vi.mock("node:fs");

describe("detectArch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns x86_64 on Linux x86_64", () => {
    vi.mocked(os.machine).mockReturnValue("x86_64");
    vi.mocked(os.type).mockReturnValue("Linux");
    expect(detectArch()).toBe("x86_64");
  });

  it("returns aarch64 on Linux aarch64", () => {
    vi.mocked(os.machine).mockReturnValue("aarch64");
    vi.mocked(os.type).mockReturnValue("Linux");
    expect(detectArch()).toBe("aarch64");
  });

  it("rejects darwin", () => {
    vi.mocked(os.machine).mockReturnValue("arm64");
    vi.mocked(os.type).mockReturnValue("Darwin");
    expect(() => detectArch()).toThrow(/Unsupported platform/);
  });

  it("rejects windows", () => {
    vi.mocked(os.machine).mockReturnValue("x86_64");
    vi.mocked(os.type).mockReturnValue("Windows_NT");
    expect(() => detectArch()).toThrow(/Unsupported platform/);
  });

  it("rejects unsupported arch on Linux", () => {
    vi.mocked(os.machine).mockReturnValue("riscv64");
    vi.mocked(os.type).mockReturnValue("Linux");
    expect(() => detectArch()).toThrow(/Unsupported platform/);
  });
});

describe("fetchArtifact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(core.info).mockImplementation(() => {});
  });

  it("constructs URL from baseUrl + version + arch-specific filename", async () => {
    const downloadTool = vi.mocked(tc.downloadTool);

    await fetchArtifact(
      "x86_64",
      "abc123",
      "https://assets.example.com/binaries/foo/",
    );
    expect(downloadTool).toHaveBeenCalledWith(
      "https://assets.example.com/binaries/foo/abc123/testquorum-runner-x86_64.zst",
    );
  });

  it("appends a trailing slash to baseUrl when missing", async () => {
    const downloadTool = vi.mocked(tc.downloadTool);

    await fetchArtifact(
      "aarch64",
      "v1",
      "https://assets.example.com/binaries/foo",
    );
    expect(downloadTool).toHaveBeenCalledWith(
      "https://assets.example.com/binaries/foo/v1/testquorum-runner-aarch64.zst",
    );
  });
});

describe("is404Error", () => {
  it("matches HTTPError with status 404", () => {
    const err = new tc.HTTPError(404);
    expect(is404Error(err)).toBe(true);
  });

  it("rejects HTTPError with other statuses", () => {
    expect(is404Error(new tc.HTTPError(403))).toBe(false);
    expect(is404Error(new tc.HTTPError(500))).toBe(false);
    expect(is404Error(new tc.HTTPError(undefined))).toBe(false);
  });

  it("rejects unrelated errors and non-error values", () => {
    expect(is404Error(new Error("nope"))).toBe(false);
    expect(is404Error("404")).toBe(false);
    expect(is404Error(undefined)).toBe(false);
    expect(is404Error(null)).toBe(false);
  });
});

describe("decompressBinary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(core.info).mockImplementation(() => {});
    vi.mocked(fs.chmodSync).mockImplementation(() => {});
  });

  it("invokes zstd -d with the expected args and chmods the output", async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);

    const result = await decompressBinary(
      "/tmp/dl/testquorum-runner-x86_64.zst",
      "testquorum-runner",
    );

    expect(result).toBe("/tmp/dl/testquorum-runner");
    expect(exec.exec).toHaveBeenCalledWith("zstd", [
      "-d",
      "--force",
      "--no-progress",
      "-o",
      "/tmp/dl/testquorum-runner",
      "/tmp/dl/testquorum-runner-x86_64.zst",
    ]);
    expect(fs.chmodSync).toHaveBeenCalledWith("/tmp/dl/testquorum-runner", 0o755);
  });
});
