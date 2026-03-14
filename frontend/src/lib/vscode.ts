declare function acquireVsCodeApi<T = any>(): WebviewApi<T>;

import { WebviewApi } from "vscode-webview";

/**
 * Utility function to get the VS Code API in the webview.
 * It uses the acquireVsCodeApi function provided by the VS Code webview environment.
 */
class VSCodeAPI {
  private static instance: WebviewApi<any> | null = null;

  public static getInstance(): WebviewApi<any> {
    if (!VSCodeAPI.instance) {
      if (typeof acquireVsCodeApi !== "undefined") {
        VSCodeAPI.instance = acquireVsCodeApi();
      } else {
        // Fallback for development outside of VS Code
        VSCodeAPI.instance = {
          postMessage: (message: any) => console.log("VS Code API (mock):", message),
          getState: () => undefined,
          setState: (state: any) => state,
        } as any;
      }
    }
    return VSCodeAPI.instance!;
  }
}

export const vscode = VSCodeAPI.getInstance();
