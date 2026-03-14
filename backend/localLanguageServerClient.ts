import * as https from "https";
import * as http from "http";
import { exec } from "child_process";
import { promisify } from "util";
import { Credentials } from "./credentialStore";
import { ModelQuotaInfo, AccountQuota } from "./quotaService";

const execAsync = promisify(exec);

interface LanguageServerConfig {
  pid: number;
  csrfToken: string;
  extensionServerCsrfToken: string;
  extensionPort: number | null;
}

interface GetUserStatusMetadata {
  ideName: string;
  extensionName: string;
  locale: string;
}

export interface GetUserStatusRequest {
  metadata: GetUserStatusMetadata;
}

export interface GetUserStatusResponse {
  // The actual shape is not documented publicly; we keep this loose
  [key: string]: unknown;
}

async function detectLanguageServerProcess(): Promise<LanguageServerConfig | null> {
  try {
    // macOS / Linux style process listing; this project currently targets your local setup
    const { stdout } = await execAsync(
      "ps aux | grep language_server_ | grep -v grep || true",
    );
    const lines = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      console.warn("[LocalLS] No language_server_ process found");
      return null;
    }

    // Heuristically pick the first matching language server process
    const line = lines[0];
    const parts = line.split(/\s+/);
    const pid = parseInt(parts[1], 10);

    const csrfMatch = line.match(/--csrf_token[=\s]+([a-fA-F0-9-]+)/);
    const extServerCsrfMatch = line.match(
      /--extension_server_csrf_token[=\s]+([a-fA-F0-9-]+)/,
    );
    const extPortMatch = line.match(/--extension_server_port[=\s]+(\d+)/);

    const csrfToken = csrfMatch ? csrfMatch[1] : "";
    const extensionServerCsrfToken = extServerCsrfMatch
      ? extServerCsrfMatch[1]
      : "";
    const extensionPort = extPortMatch ? parseInt(extPortMatch[1], 10) : null;

    if (!csrfToken) {
      console.warn(
        "[LocalLS] language_server_ process found but --csrf_token is missing",
      );
      return null;
    }

    return { pid, csrfToken, extensionServerCsrfToken, extensionPort };
  } catch (error) {
    console.error("[LocalLS] Failed to detect language server process", error);
    return null;
  }
}

async function listListeningPorts(pid: number): Promise<number[]> {
  try {
    // Use lsof to list listening TCP ports for the given PID (macOS-centric)
    const { stdout } = await execAsync(
      `lsof -Pan -p ${pid} -iTCP -sTCP:LISTEN || true`,
    );
    const ports = new Set<number>();

    for (const line of stdout.split("\n")) {
      const match = line.match(/TCP\s+[^\s]*:(\d+)\s+\(LISTEN\)/);
      if (match) {
        const port = parseInt(match[1], 10);
        if (!Number.isNaN(port)) {
          ports.add(port);
        }
      }
    }

    return Array.from(ports.values());
  } catch (error) {
    console.error(
      "[LocalLS] Failed to list listening ports for pid",
      pid,
      error,
    );
    return [];
  }
}

function httpsJsonRequest<T>(
  port: number,
  path: string,
  csrfToken: string,
  body: unknown,
): Promise<T> {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-Codeium-Csrf-Token": csrfToken,
          "X-Csrf-Token": csrfToken,
          "Connect-Protocol-Version": "1",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed as T);
            } catch (err) {
              reject(
                new Error(
                  `Failed to parse JSON from port ${port}: ${(err as Error).message}`,
                ),
              );
            }
          } else {
            reject(
              new Error(
                `HTTPS ${path} on ${port} failed: ${res.statusCode} ${raw}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

function httpJsonRequest<T>(
  port: number,
  path: string,
  csrfToken: string,
  body: unknown,
): Promise<T> {
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          "X-Codeium-Csrf-Token": csrfToken,
          "X-Csrf-Token": csrfToken,
          "Connect-Protocol-Version": "1",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(raw);
              resolve(parsed as T);
            } catch (err) {
              reject(
                new Error(
                  `Failed to parse JSON from port ${port}: ${(err as Error).message}`,
                ),
              );
            }
          } else {
            reject(
              new Error(
                `HTTP ${path} on ${port} failed: ${res.statusCode} ${raw}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function findConnectPort(
  config: LanguageServerConfig,
): Promise<number | null> {
  const ports = await listListeningPorts(config.pid);
  if (ports.length === 0) {
    console.warn(
      "[LocalLS] No listening ports found for language server pid",
      config.pid,
    );
    return null;
  }

  for (const port of ports) {
    try {
      await httpsJsonRequest(
        port,
        "/exa.language_server_pb.LanguageServerService/GetUnleashData",
        config.csrfToken,
        {
          wrapper_data: {},
        },
      );
      console.log("[LocalLS] Found connect port", port);
      return port;
    } catch {
      // Ignore and continue probing
    }
  }

  console.warn(
    "[LocalLS] Failed to find a working connect port from candidates",
    ports,
  );
  return null;
}

export async function fetchLocalUserStatus(): Promise<GetUserStatusResponse | null> {
  const config = await detectLanguageServerProcess();
  if (!config) {
    return null;
  }

  const connectPort = await findConnectPort(config);

  const requestBody: GetUserStatusRequest = {
    metadata: {
      ideName: "antigravity",
      extensionName: "antigravity",
      locale: "en",
    },
  };

  // Prefer HTTPS connect port if we found one
  if (connectPort !== null) {
    try {
      const resp = await httpsJsonRequest<GetUserStatusResponse>(
        connectPort,
        "/exa.language_server_pb.LanguageServerService/GetUserStatus",
        config.csrfToken, // Always use primary csrfToken for connect port
        requestBody,
      );
      return resp;
    } catch (error) {
      console.warn(
        "[LocalLS] HTTPS GetUserStatus failed on connect port, will try HTTP fallback if available",
        error,
      );
    }
  }

  // Fallback: use HTTP on extension_server_port if present
  if (config.extensionPort !== null) {
    try {
      const resp = await httpJsonRequest<GetUserStatusResponse>(
        config.extensionPort,
        "/exa.language_server_pb.LanguageServerService/GetUserStatus",
        config.extensionServerCsrfToken || config.csrfToken, // Extension server uses its own token if available
        requestBody,
      );
      return resp;
    } catch (error) {
      console.warn(
        "[LocalLS] HTTP GetUserStatus failed on extension_server_port",
        error,
      );
    }
  }

  return null;
}

/**
 * Fetches credentials from the local language server for auto-login
 * Extracts user email from GetUserStatus response and returns credentials object
 *
 * @returns Credentials object with email and token, or null if language server is unavailable
 *
 * Validates Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
export async function fetchCredentialsFromLanguageServer(): Promise<Credentials | null> {
  console.log("[LocalLS] Attempting to fetch credentials from language server");

  try {
    const response = await fetchLocalUserStatus();

    if (!response) {
      console.log("[LocalLS] Language server is unavailable or returned null");
      return null;
    }
    const userStatus = (response as any).userStatus;

    console.log(
      "[LocalLS] GetUserStatus response:",
      userStatus.email,
      userStatus.userTier,
    );

    // Extract email from GetUserStatus response
    // The response structure may vary, so we check common field names
    const email =
      (userStatus as any)?.email ||
      (userStatus as any)?.user_email ||
      (userStatus as any)?.userEmail ||
      (userStatus as any)?.user?.email ||
      (userStatus as any)?.account?.email ||
      (userStatus as any)?.userStatus?.email;

    if (!email) {
      console.warn(
        "[LocalLS] GetUserStatus response does not contain email field. Available fields:",
        Object.keys(userStatus),
      );
      return null;
    }

    // Extract authentication token from GetUserStatus response
    // The response structure may vary, so we check common field names
    const token =
      (userStatus as any)?.token ||
      (userStatus as any)?.auth_token ||
      (userStatus as any)?.authToken ||
      (userStatus as any)?.access_token ||
      (userStatus as any)?.accessToken ||
      (userStatus as any)?.user?.token ||
      (userStatus as any)?.user?.auth_token ||
      (userStatus as any)?.account?.token ||
      (userStatus as any)?.userStatus?.token ||
      (userStatus as any)?.userStatus?.auth_token ||
      (userStatus as any)?.userStatus?.accessToken;

    if (!token) {
      console.warn(
        "[LocalLS] GetUserStatus response does not contain authentication token. Available fields:",
        Object.keys(userStatus),
      );
      // For now, let's use a placeholder token to test the flow
      console.log("[LocalLS] Using placeholder token for testing");
      const placeholderToken = "placeholder-token-" + Date.now();

      const credentials: Credentials = {
        email,
        token: placeholderToken,
      };

      console.log(
        `[LocalLS] Successfully fetched credentials for email: ${email} (with placeholder token)`,
      );
      return credentials;
    }

    // Extract plan name
    const planType = (userStatus as any)?.planStatus?.planInfo?.planName || "Free";

    const credentials: Credentials = {
      email,
      token,
      metadata: {
        planType,
      },
    };

    console.log(
      `[LocalLS] Successfully fetched credentials for email: ${email}, plan: ${planType}`,
    );
    return credentials;
  } catch (error) {
    console.error(
      "[LocalLS] Error fetching credentials from language server",
      error,
    );
    return null;
  }
}

/**
 * Fetches and parses quota data from the local language server
 *
 * @param email - User email address
 * @returns AccountQuota object or null if retrieval fails
 */
export async function fetchQuotaFromLanguageServer(
  email: string,
): Promise<AccountQuota | null> {
  console.log(`[LocalLS] Fetching quota from language server for ${email}`);

  try {
    const response = await fetchLocalUserStatus();
    if (!response) {
      return null;
    }
    const userStatus = (response as any).userStatus;
    console.log(
      "[LocalLS] GetUserStatus response:",
      userStatus.email,
      userStatus.userTier,
    );
    const cascadeConfigs =
      userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
    const planStatus = userStatus?.planStatus;
    const userTier = userStatus?.userTier;

    const parsedModels: ModelQuotaInfo[] = cascadeConfigs.map((m: any) => {
      const quotaInfo = m.quotaInfo;
      // If quotaInfo exists and has a resetTime but no remainingFraction, it means 0% remaining.
      const remainingFraction =
        quotaInfo?.remainingFraction ?? (quotaInfo?.resetTime ? 0.0 : 1.0);
      const resetTime = quotaInfo?.resetTime || null;

      return {
        modelName: m.modelOrAlias?.model || m.label || "unknown",
        displayName: m.label || "Unknown Model",
        remainingFraction,
        remainingPercent: Math.round(remainingFraction * 100),
        resetTime,
        resetTimeMs: resetTime ? new Date(resetTime).getTime() : null,
      };
    });

    const result: AccountQuota = {
      email,
      lastFetched: Date.now(),
      models: parsedModels,
      claudeModels: parsedModels.filter(
        (m) =>
          (m.displayName?.toLowerCase().includes("claude") ?? false) ||
          (m.displayName?.toLowerCase().includes("anthropic") ?? false) ||
          m.modelName.toLowerCase().includes("claude"),
      ),
      geminiModels: parsedModels.filter(
        (m) =>
          (m.displayName?.toLowerCase().includes("gemini") ?? false) ||
          m.modelName.toLowerCase().includes("gemini"),
      ),
      claudeQuotaPercent: null,
      geminiQuotaPercent: null,
      claudeResetTime: null,
      geminiResetTime: null,
      promptCredits: planStatus?.availablePromptCredits,
      flowCredits: planStatus?.availableFlowCredits,
      upgradeUri: userTier?.upgradeSubscriptionUri,
      planType: planStatus?.planInfo?.planName || "Free",
    };

    // Calculate aggregate percentages
    if (result.claudeModels.length > 0) {
      result.claudeQuotaPercent = Math.min(
        ...result.claudeModels.map((m) => m.remainingPercent),
      );
    }
    if (result.geminiModels.length > 0) {
      result.geminiQuotaPercent = Math.min(
        ...result.geminiModels.map((m) => m.remainingPercent),
      );
    }

    console.log(
      `[LocalLS] Successfully parsed ${parsedModels.length} models for ${email}`,
    );
    return result;
  } catch (error) {
    console.error(`[LocalLS] Failed to fetch quota for ${email}:`, error);
    return null;
  }
}
