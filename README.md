# Antigravity Monitor

Monitor Antigravity AI agent status and model quotas directly inside VS Code.

Antigravity Monitor is a VS Code extension that provides a real-time dashboard for tracking your Gemini and Claude model usage. It helps you stay within your quota limits by showing remaining usage and reset times.

## Features

- **Real-time Quotas**: View remaining quota for Claude and Gemini model families.
- **Active Agents**: Track running AI agents and their current load.
- **Integrated Dashboard**: Access all monitoring data through a beautiful, modern UI inside VS Code.
- **Automatic Auth**: Seamlessly integrates with VS Code's authentication providers (Google, Antigravity).

## Quick Start

### Installation

1. Open VS Code.
2. Search for "Antigravity Monitor" in the Extensions view.
3. Click **Install**.

### Usage

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux).
2. Type `Antigravity Monitor: Open Dashboard` and press Enter.
3. If prompted, sign in with your Google or Antigravity account.

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
