# Antigravity Monitor

Monitor Antigravity AI agent status and model quotas directly inside VS Code.

Antigravity Monitor is a VS Code extension that provides a real-time dashboard for tracking your Gemini and Claude model usage. It helps you stay within your quota limits by showing remaining usage and reset times.

## Features

- **Real-time Quotas**: View remaining quota for Claude and Gemini model families.
- **Side Panel Integration**: Access your dashboard directly from the VS Code Activity Bar for a seamless, always-on experience.
- **Local Session Monitoring**: Automatically detects your active AI assistant session (e.g., Codeium/Antigravity) without requiring manual login.
- **Heartbeat Status**: Keep track of the health and availability of your local AI assistant.

## Usage

1. **Activity Bar**: Click on the **Antigravity Monitor** icon (the stylized 'A' with a heartbeat) in the VS Code Activity Bar on the left.
2. **Side Panel**: The dashboard will open instantly in the side panel, showing your current local session status and model quotas.
3. **Command Palette**: You can also use `Antigravity Monitor: Open Dashboard` from the Command Palette (`Cmd+Shift+P`) to focus the monitor.

## Development Setup

### Project Structure

- `backend/`: VS Code extension source code (TypeScript).
  - `extension.ts`: Main entry point and webview management.
  - `quotaService.ts`: Logic for fetching and calculating model quotas.
  - `localLanguageServerClient.ts`: Integration with the local Antigravity language server.
- `frontend/`: Dashboard UI source code (Next.js + React + Vite).
  - `src/components/`: Reusable UI components.
  - `src/app/`: Main application logic.
- `docs/`: Technical documentation and overviews.

### Building

To build both the frontend and backend:

```bash
npm install
npm run build:all
```

To run the extension in development mode, open the project in VS Code and press `F5` to start the Extension Development Host.

## Technical Overview

Antigravity Monitor works by bridging a Next.js-based webview with a background service in the VS Code extension. It communicates with a local language server process to retrieve high-fidelity status information and model availability.

For more details, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
