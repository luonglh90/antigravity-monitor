# Specification: AI Credit Management in Header

## Overview
Add a new row at the bottom of the header to display the available AI credit balance and a toggle for "Enable AI Credit Overages".

## Requirements
1.  **AI Credit Display**:
    *   Show "Available AI Credit" value in the header.
    *   The value should be fetched from the Language Server (via `planStatus.availableAiCredits` or similar).
    *   If the value is not available, show "—".
2.  **Credit Overages Setting**:
    *   Add a toggle switch labeled "Enable AI Credit Overages".
    *   This setting should be persistent (stored in VS Code's configuration).
    *   Changing the toggle should update the configuration.
3.  **UI/UX**:
    *   The new elements should be placed in a new row at the bottom of the header.
    *   Maintain the existing premium aesthetic (glassmorphism, subtle borders, etc.).
    *   The toggle should have a clear "On/Off" state with micro-animations.

## Technical Details
*   **Backend**:
    *   Update `AccountQuota` interface in `quotaService.ts` to include `aiCredits: number | undefined`.
    *   Update `fetchQuotaFromLanguageServer` in `localLanguageServerClient.ts` to parse `availableAiCredits`.
    *   Add a new command to handle toggling the overage setting if it needs to be synced with the server (currently assuming it's a local VS Code setting).
*   **Frontend**:
    *   Update `QuotaData` interface in `AccountContext.tsx` to include `aiCredits`.
    *   Modify `Header.tsx` to add the new row.
    *   Add a message handler to `AccountContext` or `Header` to fetch/update the overage setting.
