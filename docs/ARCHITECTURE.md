# Technical Architecture - Antigravity Monitor

This document describes the technical design and internal workings of the Antigravity Monitor extension.

## High-Level Overview

Antigravity Monitor consists of two main parts:
1. **VS Code Extension (Backend)**: Manages the extension lifecycle, commands, and communication with the local language server.
2. **Webview UI (Frontend)**: A modern React-based dashboard that visualizes quota data. It is integrated directly into the VS Code Side Panel (Activity Bar).

```mermaid
graph TD
    subgraph VS Code
        E[Extension Host]
        W[Webview View (Side Panel)]
    end
    
    subgraph Local System
        LS[Antigravity Language Server]
    end

    W -- postMessage --> E
    E -- postMessage --> W
    E -- HTTP/HTTPS --> LS
```

## Backend Implementation

### Activity Bar Provider (`backend/extension.ts`)
The extension implements a `WebviewViewProvider` to manage the Side Panel integration.
- **Provider Registration**: The `AntigravityWebviewViewProvider` is registered with the ID `antigravity.monitorView`.
- **UI Resolution**: When the side panel is opened, the provider resolves the bundled assets in `frontend/dist` and injects them into the webview.
- **State Management**: The provider handles the `webviewReady` message to trigger the initial local session discovery and quota fetch.

### Local Language Server Client (`backend/localLanguageServerClient.ts`)
The extension monitors a local `language_server_` process to fetch the current user's status and credentials.
- **Process Discovery**: Uses `ps aux` and `lsof` to find the running LS process and its listening ports.
- **CSRF Protection**: Extracts security tokens from process arguments for authenticated communication.
- **Session Extraction**: Automatically extracts the active user email and plan type from the LS status response.

### Quota Service (`backend/quotaService.ts`)
Encapsulates the logic for parsing and normalizing quota data from the language server.
- **Family Grouping**: Groups raw model data into logical families (Claude, Gemini).
- **Quota Calculation**: Calculates percentage-based remaining usage and predicts reset times.

## Frontend Implementation

The frontend is a static React application built using `Vite` and served inside the VS Code side panel.

### Communication Bridge
The UI uses the VS Code API (`window.acquireVsCodeApi()`) to send and receive messages from the extension host.

### Dashboard Components
- **Header**: Displays the active local session email and refresh triggers.
- **ModelsQuota**: Visualizes remaining API usage with responsive progress bars.
- **Status Monitor**: Displays the "heartbeat" of the local AI assistant connection.

## Data Flow: Fetching Quotas

1. **Initialization**: When the side panel opens, the UI sends `webviewReady`.
2. **Discovery**: The backend detects the local language server and fetches the active session status.
3. **Response**: The backend sends `autoLoginSuccess` and the initial `quotaData` to the UI.
4. **Periodic Sync**: The UI automatically triggers `fetchQuotas` every 60 seconds (or manually via refresh) to keep data current.
