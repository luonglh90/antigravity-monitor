import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as dns from "dns";
import { fetchCredentialsFromLanguageServer, fetchQuotaFromLanguageServer } from "./localLanguageServerClient";

class AntigravityWebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "antigravity.monitorView";
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "frontend", "dist"),
      ],
    };
    const outPath = path.join(this._extensionUri.fsPath, "frontend", "dist");
    const htmlPath = path.join(outPath, "index.html");

    if (!fs.existsSync(htmlPath)) {
      webviewView.webview.html = `
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
    const baseUri = webviewView.webview.asWebviewUri(vscode.Uri.file(outPath));

    html = html.replace(/(href|src)="([^"]*)"/g, (match, p1, p2) => {
      if (
        p2.startsWith("http") ||
        p2.startsWith("data:") ||
        p2.startsWith("vscode-webview:")
      ) {
        return match;
      }
      const normalizedPath = p2.replace(/^(\.\/|\/)/, "");
      return `${p1}="${baseUri}/${normalizedPath}"`;
    });

    webviewView.webview.html = html;

    const initializeBackendState = async () => {
      webviewView.webview.postMessage({ command: "autoLoginStarted" });

      try {
        console.log("[Extension] Fetching local credentials from LS...");
        const credentials = await fetchCredentialsFromLanguageServer();

        if (credentials) {
          console.log("[Extension] Local account detected:", credentials.email);
          webviewView.webview.postMessage({
            command: "autoLoginSuccess",
            account: credentials,
          });

          const quota = await fetchQuotaFromLanguageServer(credentials.email);
          if (quota) {
            // Check VS Code config if the LS doesn't provide it
            if (quota.enableAiCreditOverages === undefined) {
              const config = vscode.workspace.getConfiguration("antigravity");
              quota.enableAiCreditOverages = config.get<boolean>("enableAiCreditOverages", false);
            }
            webviewView.webview.postMessage({
              command: "quotaData",
              data: quota,
            });
          }
        } else {
          console.log("[Extension] No local account detected");
          webviewView.webview.postMessage({ command: "autoLoginFailed" });
        }
      } catch (error) {
        console.error("[Extension] Initialization failed:", error);
        webviewView.webview.postMessage({
          command: "error",
          error: "Failed to initialize monitor. Is the Language Server running?",
        });
      }
    };

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        try {
          if (message.command === "webviewReady") {
            await initializeBackendState();
          } else if (message.command === "fetchQuotas") {
            try {
              const credentials = await fetchCredentialsFromLanguageServer();
              if (credentials) {
                const quota = await fetchQuotaFromLanguageServer(credentials.email);
                if (quota && (quota.enableAiCreditOverages === undefined || quota.enableAiCreditOverages === null)) {
                  const config = vscode.workspace.getConfiguration("antigravity");
                  quota.enableAiCreditOverages = config.get<boolean>("enableAiCreditOverages", false);
                }
                webviewView.webview.postMessage({
                  command: "quotaData",
                  data: quota || {
                    email: credentials.email,
                    lastFetched: Date.now(),
                    models: [],
                  },
                  cached: false,
                });
              }
            } catch (error: any) {
              webviewView.webview.postMessage({
                command: "quotaError",
                error: error.message ?? String(error),
              });
            }
          } else if (message.command === "toggleAiCreditOverages") {
            try {
              console.log("[Extension] Toggling AI credit overages to:", message.value);
              const config = vscode.workspace.getConfiguration("antigravity");
              await config.update("enableAiCreditOverages", message.value, vscode.ConfigurationTarget.Global);
              
              // RE-FETCH the configuration to get the updated value!
              const updatedConfig = vscode.workspace.getConfiguration("antigravity");
              const updatedConfigValue = updatedConfig.get<boolean>("enableAiCreditOverages");
              console.log("[Extension] Configuration updated. New value from config:", updatedConfigValue);

              // Refresh quotas to update UI
              const credentials = await fetchCredentialsFromLanguageServer();
              if (credentials) {
                const quota = await fetchQuotaFromLanguageServer(credentials.email);
                if (quota) {
                  // If the server doesn't provide the setting, use the newly updated local value
                  if (quota.enableAiCreditOverages == null) {
                    quota.enableAiCreditOverages = message.value;
                  }
                  
                  console.log("[Extension] Sending updated quota data to webview for email:", credentials.email, "overages =", quota.enableAiCreditOverages);
                  webviewView.webview.postMessage({
                    command: "quotaData",
                    data: quota,
                    cached: false,
                  });
                }
              }
            } catch (error: any) {
              console.error("[Extension] Failed to toggle overages:", error);
            }
          }
        } catch (error: any) {
          webviewView.webview.postMessage({
            command: "error",
            error: "An unexpected error occurred",
          });
        }
      },
    );
  }
}

export function activate(context: vscode.ExtensionContext) {
  if ((dns as any).setDefaultAutoSelectFamilyAttemptTimeout) {
    (dns as any).setDefaultAutoSelectFamilyAttemptTimeout(1000);
  }
  console.log("Antigravity Monitor extension is now active!");

  const provider = new AntigravityWebviewViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AntigravityWebviewViewProvider.viewType,
      provider,
    ),
  );
}

export function deactivate() {}
