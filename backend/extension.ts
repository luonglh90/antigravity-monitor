import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as dns from "dns";
import { fetchCredentialsFromLanguageServer, fetchQuotaFromLanguageServer } from "./localLanguageServerClient";
import { CredentialStore } from "./credentialStore";
import { AccountManager } from "./accountManager";

/**
 * Implements exponential backoff retry logic for auto-login
 * Requirement 11.1, 11.2: Up to 3 retries with exponential backoff
 */
async function attemptAutoLoginWithRetry(
  accountManager: AccountManager,
  maxRetries: number = 3,
): Promise<boolean> {
  console.log("[Extension] Starting auto-login with retry logic");

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(
        `[Extension] Auto-login attempt ${attempt + 1}/${maxRetries}`,
      );

      // Fetch credentials from language server
      const credentials = await fetchCredentialsFromLanguageServer();

      if (!credentials) {
        console.log(
          "[Extension] No credentials available from language server",
        );
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = 1000 * Math.pow(2, attempt);
          console.log(`[Extension] Retrying auto-login in ${delayMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }
        return false;
      }

      // Try to add account if not already present
      try {
        const existingAccount = accountManager.getAccount(credentials.email);
        if (!existingAccount) {
          await accountManager.addAccount(credentials.email, credentials.token, credentials.metadata);
          console.log(`[Extension] New account added: ${credentials.email}`);
        } else {
          // Update metadata if it exists
          if (credentials.metadata) {
            await accountManager.setActiveAccount(credentials.email); // This also updates metadata
          }
          console.log(
            `[Extension] Account already exists: ${credentials.email}`,
          );
        }
      } catch (error: any) {
        if (!error.message?.includes("already exists")) {
          throw error;
        }
      }

      // Set as active account
      await accountManager.setActiveAccount(credentials.email);
      console.log(`[Extension] Auto-login successful for ${credentials.email}`);

      return true;
    } catch (error: any) {
      console.error(
        `[Extension] Auto-login attempt ${attempt + 1} failed:`,
        error,
      );

      if (attempt < maxRetries - 1) {
        // Exponential backoff
        const delayMs = 1000 * Math.pow(2, attempt);
        console.log(`[Extension] Retrying auto-login in ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  console.log("[Extension] Auto-login failed after all retry attempts");
  return false;
}

export function activate(context: vscode.ExtensionContext) {
  // Set default auto-select family attempt timeout to 1000ms to improve network reliability
  if ((dns as any).setDefaultAutoSelectFamilyAttemptTimeout) {
    (dns as any).setDefaultAutoSelectFamilyAttemptTimeout(1000);
  }
  console.log("Antigravity Monitor extension is now active!");

  // Initialize backend services
  const credentialStore = new CredentialStore(context);
  const accountManager = new AccountManager(credentialStore);

  let disposable = vscode.commands.registerCommand(
    "antigravity-monitor.open",
    async () => {
      const panel = vscode.window.createWebviewPanel(
        "antigravityMonitor",
        "Antigravity Monitor",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [
            vscode.Uri.file(
              path.join(context.extensionPath, "frontend", "dist"),
            ),
          ],
        },
      );

      const outPath = path.join(context.extensionPath, "frontend", "dist");
      const htmlPath = path.join(outPath, "index.html");

      if (!fs.existsSync(htmlPath)) {
        vscode.window.showErrorMessage(
          "Antigravity Monitor UI not found. Please build the extension first.",
        );
        panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <body>
          <h1>UI Not Found</h1>
          <p>Please run <code>npm run build:all</code> to build the Next.js UI.</p>
        </body>
        </html>
      `;
        return;
      }

      let html = fs.readFileSync(htmlPath, "utf8");

      // Convert all root-relative and relative paths (e.g., href="/assets/..." or src="./assets/...") to webview URIs
      const baseUri = panel.webview.asWebviewUri(vscode.Uri.file(outPath));

      // Replace all relative href and src attributes with webview URIs
      html = html.replace(/(href|src)="([^"]*)"/g, (match, p1, p2) => {
        // Don't replace external URLs
        if (
          p2.startsWith("http") ||
          p2.startsWith("data:") ||
          p2.startsWith("vscode-webview:")
        ) {
          return match;
        }
        // Normalize path (remove leading ./ or /)
        const normalizedPath = p2.replace(/^(\.\/|\/)/, "");
        return `${p1}="${baseUri}/${normalizedPath}"`;
      });

      let backendInitialized = false;

      // Helper to initialize account state and auto-login
      const initializeBackendState = async () => {
        if (backendInitialized) return;
        backendInitialized = true;

        // Initialize account manager with stored accounts
        try {
          console.log("[Extension] Initializing account manager...");
          await accountManager.initialize();

          // Check if we already have accounts stored
          const existingAccounts = accountManager.getAllAccounts();
          console.log(
            "[Extension] Found",
            existingAccounts.length,
            "existing accounts",
          );

          if (existingAccounts.length > 0) {
            // If we have existing accounts, try to set the first one as active
            const firstAccount = existingAccounts[0];
            console.log(
              "[Extension] Setting existing account as active:",
              firstAccount.email,
            );
            await accountManager.setActiveAccount(firstAccount.email);

            // Send success message immediately
            panel.webview.postMessage({
              command: "autoLoginSuccess",
              account: firstAccount,
            });

            // Send full account list
            panel.webview.postMessage({
              command: "accountList",
              accounts: existingAccounts,
            });

            // Fetch quota for the account
            try {
              console.log("[Extension] Fetching quota for existing account from LS...");
              const quota = await fetchQuotaFromLanguageServer(
                firstAccount.email
              );
              console.log("[Extension] Quota fetched successfully");
              if (quota) {
                panel.webview.postMessage({ command: "quotaData", data: quota });
              }
            } catch (error: any) {
              console.error(
                "[Extension] Failed to fetch quota for existing account:",
                error,
              );
              panel.webview.postMessage({
                command: "quotaError",
                error: "Failed to fetch quota data",
              });
            }

            console.log(
              "[Extension] Account manager initialized successfully with existing account",
            );
            return; // Skip auto-login since we have an existing account
          }

          console.log(
            "[Extension] No existing accounts found, proceeding with auto-login",
          );
        } catch (error) {
          console.error(
            "[Extension] Failed to initialize account manager:",
            error,
          );
          panel.webview.postMessage({
            command: "error",
            error: "Failed to load accounts. Please try again.",
          });
        }

        // Requirement 1.6: Display loading indicator during auto-login
        console.log("[Extension] Starting auto-login process...");
        panel.webview.postMessage({ command: "autoLoginStarted" });

        // Attempt auto-login
        const autoLoginSuccess =
          await attemptAutoLoginWithRetry(accountManager);
        console.log("[Extension] Auto-login result:", autoLoginSuccess);

        if (autoLoginSuccess) {
          // Requirement 1.3: Navigate to Dashboard on success
          const activeAccount = accountManager.getActiveAccount();
          console.log(
            "[Extension] Active account after auto-login:",
            activeAccount?.email,
          );

          if (activeAccount) {
            panel.webview.postMessage({
              command: "autoLoginSuccess",
              account: activeAccount,
            });

            // Send full account list
            panel.webview.postMessage({
              command: "accountList",
              accounts: accountManager.getAllAccounts(),
            });

            // Fetch quota for active account
            try {
              console.log("[Extension] Fetching quota for active account from LS...");
              const quota = await fetchQuotaFromLanguageServer(
                activeAccount.email
              );
              console.log("[Extension] Quota fetched successfully");
              if (quota) {
                panel.webview.postMessage({ command: "quotaData", data: quota });
              }
            } catch (error: any) {
              console.error(
                "[Extension] Failed to fetch quota after auto-login:",
                error,
              );
              panel.webview.postMessage({
                command: "quotaError",
                error: "Failed to fetch quota data",
              });
            }
          }
        } else {
          // Requirement 1.4, 1.5: Display Login component on failure
          console.log("[Extension] Auto-login failed, showing login screen");
          panel.webview.postMessage({ command: "autoLoginFailed" });
        }
      };

      // Listen to messages from the webview
      panel.webview.onDidReceiveMessage(
        async (message) => {
          try {
            if (message.command === "webviewReady") {
              console.log(
                "[Extension] Webview is ready, initializing backend state",
              );
              await initializeBackendState();
            } else if (message.command === "login") {
              // Requirement 1.5: Manual authentication when auto-login fails
              try {
                // Try Google authentication provider
                let session = await vscode.authentication.getSession(
                  "google",
                  ["email"],
                  { createIfNone: true },
                );

                if (session && session.account && session.account.label) {
                  const email = session.account.label;
                  const token = session.accessToken;

                  // Add account
                  try {
                    const existingAccount = accountManager.getAccount(email);
                    if (!existingAccount) {
                      // Manual login might not have rich metadata, but we can try to fetch it or just add
                      await accountManager.addAccount(email, token);
                    }
                  } catch (error: any) {
                    if (!error.message?.includes("already exists")) {
                      throw error;
                    }
                  }

                  // Set as active
                  await accountManager.setActiveAccount(email);

                  // Fetch quota from LS
                  const quota = await fetchQuotaFromLanguageServer(email);
                  panel.webview.postMessage({
                    command: "loginSuccess",
                    account: { email, token },
                    quota: quota || { email, lastFetched: Date.now(), models: [] },
                  });

                  // Send full account list
                  panel.webview.postMessage({
                    command: "accountList",
                    accounts: accountManager.getAllAccounts(),
                  });
                } else {
                  throw new Error("Failed to get authentication session");
                }
              } catch (error: any) {
                console.error("[Extension] Login failed:", error);
                panel.webview.postMessage({
                  command: "error",
                  error: `Login failed: ${error.message}`,
                });
              }
            } else if (message.command === "addAccount") {
              // Requirement 4.1, 4.2, 4.3: Add account handler
              try {
                // Try Google authentication provider
                let session = await vscode.authentication.getSession(
                  "google",
                  ["email"],
                  { createIfNone: true },
                );

                if (session && session.account && session.account.label) {
                  const email = session.account.label;
                  const token = session.accessToken;

                  // Check for duplicate
                  const existingAccount = accountManager.getAccount(email);
                  if (existingAccount) {
                    panel.webview.postMessage({
                      command: "error",
                      error: `Account ${email} already exists`,
                    });
                    return;
                  }

                  // Add account
                  await accountManager.addAccount(email, token);
                  panel.webview.postMessage({
                    command: "accountAdded",
                    account: { email, token },
                  });

                  // Send full account list
                  panel.webview.postMessage({
                    command: "accountList",
                    accounts: accountManager.getAllAccounts(),
                  });
                } else {
                  throw new Error("Failed to get authentication session");
                }
              } catch (error: any) {
                console.error("[Extension] Add account failed:", error);
                panel.webview.postMessage({
                  command: "error",
                  error: `Failed to add account: ${error.message}`,
                });
              }
            } else if (message.command === "switchAccount") {
              // Requirement 5.3, 5.4, 8.1, 8.2, 8.3: Switch account handler
              try {
                const { email } = message;
                if (!email) {
                  throw new Error("Email is required for account switch");
                }

                const account = accountManager.getAccount(email);
                if (!account) {
                  throw new Error(`Account ${email} not found`);
                }

                // Requirement 5.4: Trigger quota fetch on switch
                const quota = await fetchQuotaFromLanguageServer(email);
                panel.webview.postMessage({
                  command: "accountSwitched",
                  account,
                  quota: quota || { email, lastFetched: Date.now(), models: [] },
                });

                // Send full account list
                panel.webview.postMessage({
                  command: "accountList",
                  accounts: accountManager.getAllAccounts(),
                });
              } catch (error: any) {
                console.error("[Extension] Switch account failed:", error);
                panel.webview.postMessage({
                  command: "error",
                  error: `Failed to switch account: ${error.message}`,
                });
              }
            } else if (message.command === "removeAccount") {
              // Requirement 8.1, 8.2, 8.3, 8.4, 8.5, 8.6: Remove account handler
              try {
                const { email } = message;
                if (!email) {
                  throw new Error("Email is required for account removal");
                }

                const account = accountManager.getAccount(email);
                if (!account) {
                  throw new Error(`Account ${email} not found`);
                }

                // Remove account
                await accountManager.removeAccount(email);

                // Get new active account if one exists
                const newActiveAccount = accountManager.getActiveAccount();
                if (newActiveAccount) {
                  const quota = await fetchQuotaFromLanguageServer(
                    newActiveAccount.email
                  );
                  panel.webview.postMessage({
                    command: "accountRemoved",
                    account: newActiveAccount,
                    quota: quota || { email: newActiveAccount.email, lastFetched: Date.now(), models: [] },
                  });
                } else {
                  panel.webview.postMessage({
                    command: "accountRemoved",
                    account: null,
                  });
                }

                // Send full account list
                panel.webview.postMessage({
                  command: "accountList",
                  accounts: accountManager.getAllAccounts(),
                });
              } catch (error: any) {
                console.error("[Extension] Remove account failed:", error);
                panel.webview.postMessage({
                  command: "error",
                  error: `Failed to remove account: ${error.message}`,
                });
              }
            } else if (message.command === "fetchQuotas") {
              // Requirement 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.1, 15.2, 15.5: Fetch quotas with caching
              try {
                const activeAccount = accountManager.getActiveAccount();
                if (!activeAccount) {
                  panel.webview.postMessage({
                    command: "quotaError",
                    error: "No active account",
                  });
                  return;
                }

                // Fetch fresh quota immediately from LS
                const quota = await fetchQuotaFromLanguageServer(
                  activeAccount.email
                );
                panel.webview.postMessage({
                  command: "quotaData",
                  data: quota || { email: activeAccount.email, lastFetched: Date.now(), models: [] },
                  cached: false,
                });
              } catch (error: any) {
                console.error("[Extension] Fetch quotas failed:", error);
                panel.webview.postMessage({
                  command: "quotaError",
                  error: error.message ?? String(error),
                });
              }
            }
          } catch (error: any) {
            console.error(
              "[Extension] Unexpected error handling message:",
              error,
            );
            panel.webview.postMessage({
              command: "error",
              error: "An unexpected error occurred",
            });
          }
        },
        undefined,
        context.subscriptions,
      );

      // FINALLY set the HTML to trigger the webview to start loading
      panel.webview.html = html;
    },
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}
