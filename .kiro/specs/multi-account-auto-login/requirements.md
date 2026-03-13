# Requirements: Multi-Account Auto-Login Feature

## Overview

The multi-account auto-login feature enables users to authenticate automatically using local language server credentials and manage multiple Antigravity accounts within the VS Code extension. This feature improves user experience by reducing manual authentication steps and allowing seamless switching between accounts.

## Functional Requirements

### 1. Auto-Login Flow

1.1 The extension shall attempt automatic login on activation using local language server credentials.

1.2 Auto-login shall be transparent to the user with minimal UI disruption.

1.3 On successful auto-login, the extension shall navigate to the Dashboard component.

1.4 On failed auto-login, the extension shall display the Login component.

1.5 The Login component shall allow manual authentication when auto-login fails.

1.6 A loading indicator shall be displayed during the auto-login process.

### 2. Credential Fetching from Language Server

2.1 The extension shall fetch credentials from the local language server on startup.

2.2 Credentials shall include the user's email address extracted from GetUserStatus response.

2.3 Credentials shall include an authentication token for API requests.

2.4 The system shall handle missing or unavailable language server gracefully.

2.5 All credential fetch attempts shall be logged for debugging purposes.

### 3. Credential Storage and Management

3.1 The system shall securely store user credentials using VS Code's SecureStorage API.

3.2 Credentials shall be associated with a user email address as the unique identifier.

3.3 The system shall support storing multiple sets of credentials for different accounts.

3.4 The system shall provide methods to retrieve stored credentials by email.

3.5 All credentials shall be encrypted before storage and never stored in plaintext.

3.6 Storage failures shall be handled gracefully with fallback to in-memory storage.

### 4. Account Management UI

4.1 The extension shall provide an "Add Account" button in the header for adding new accounts.

4.2 Users shall be able to add new accounts without removing existing ones.

4.3 The system shall detect and prevent duplicate account additions.

4.4 Adding an account shall trigger the Login component in add-account mode.

4.5 New accounts shall be immediately available in the account switcher after addition.

4.6 The system shall track account metadata including plan type and last login time.

### 5. Account Switching

5.1 The extension shall display the currently active account email prominently in the header.

5.2 The extension shall provide a dropdown menu showing all available accounts.

5.3 Users shall be able to switch between accounts by selecting from the dropdown.

5.4 Account switching shall trigger a quota data refresh for the selected account.

5.5 Each account in the dropdown shall display its associated email address.

5.6 The currently active account shall be visually indicated in the dropdown.

### 6. Login Component Modes

6.1 The Login component shall support two modes: "login" and "add-account".

6.2 In login mode, the button text shall be "Login".

6.3 In add-account mode, the button text shall be "Add Account".

6.4 In add-account mode, a "Cancel" button shall be displayed to return to the dashboard.

6.5 Both modes shall maintain consistent styling and user experience.

6.6 The component shall send the appropriate command to the extension based on the mode.

### 7. Quota Management

7.1 The system shall fetch quota data for the currently active account.

7.2 Quota data shall be displayed in the Dashboard component.

7.3 Quota data shall be updated when switching accounts.

7.4 Quota fetch errors shall be handled gracefully with user-friendly error messages.

7.5 The system shall support per-account quota caching with TTL.

7.6 Background quota refresh shall occur while displaying cached data to the user.

### 8. Account Removal

8.1 Each account in the dropdown shall have a "Remove" option.

8.2 Users shall be able to remove accounts from the system.

8.3 Removing the active account shall switch to another available account.

8.4 Removing the last account shall display the Login component.

8.5 Removed account credentials shall be deleted from secure storage.

8.6 Cached quota data for removed accounts shall be cleared.

### 9. Account Metadata

9.1 The system shall store account metadata including email and authentication token.

9.2 Account metadata shall include the plan type associated with the account.

9.3 Account metadata shall include the last login timestamp.

9.4 Last login time shall be updated whenever an account is switched to.

9.5 Plan type shall be displayed in the header for the active account.

### 10. Error Handling

10.1 Account operation errors shall be caught and reported to the user.

10.2 Error messages shall be user-friendly and suggest corrective actions.

10.3 Failed account operations shall not corrupt existing account data.

10.4 Language server unavailability shall be handled gracefully without blocking the extension.

10.5 Quota fetch failures shall display an error message with retry capability.

10.6 All errors shall be logged for debugging and support purposes.

### 11. Auto-Login Retry Logic

11.1 Auto-login shall retry up to 3 times on transient failures.

11.2 Retry delays shall follow an exponential backoff pattern.

11.3 Successful authentication on any retry attempt shall stop further retries.

11.4 All auto-login attempts and retries shall be logged for debugging.

### 12. Account Isolation and Security

12.1 Session data from one account shall not be accessible to another account.

12.2 Switching accounts shall clear all session data from the previous account.

12.3 Quota data from one account shall not leak to another account.

12.4 Credentials shall be encrypted using VS Code's SecureStorage API.

12.5 The system shall support secure credential deletion on account removal.

12.6 Account isolation shall be maintained across all operations.

### 13. Account Switcher UI

13.1 The AccountSwitcher component shall be positioned prominently in the header.

13.2 The AccountSwitcher shall be accessible with a single click.

13.3 The dropdown menu shall display all available accounts.

13.4 The dropdown shall auto-close after account selection.

13.5 An "Add Account" button shall be displayed next to the AccountSwitcher.

13.6 Account management UI shall not interfere with main dashboard content.

### 14. Single Account Mode

14.1 When only one account is available, the AccountSwitcher shall display without a dropdown menu.

### 15. Quota Caching Strategy

15.1 Quota data shall be cached with a configurable TTL (default 5 minutes).

15.2 Cached quota data shall be displayed immediately while fresh data is fetched in the background.

15.3 Cache entries shall expire after the TTL period.

15.4 Expired cache entries shall not be returned to the user.

15.5 Manual refresh shall invalidate the cache and fetch fresh data.

15.6 The default TTL for quota cache shall be 5 minutes.

## Non-Functional Requirements

### Performance

- Account switching shall complete within 500ms.
- Quota cache shall reduce API calls by at least 80% for typical usage patterns.
- Background quota refresh shall not block the UI.

### Security

- All credentials shall be encrypted using VS Code's SecureStorage API.
- Credentials shall never be logged or exposed in error messages.
- Session data shall be cleared when switching accounts.

### Reliability

- The system shall gracefully handle language server unavailability.
- Failed operations shall not corrupt existing data.
- All errors shall be logged for debugging and support.

### Usability

- Error messages shall be clear and actionable.
- The UI shall provide clear visual feedback for account operations.
- Account management shall be intuitive and require minimal user training.

## Acceptance Criteria

All requirements listed above (1.1 through 15.6) must be met for the feature to be considered complete. Additionally:

- All unit tests must pass.
- All property-based tests must pass.
- All integration tests must pass.
- Code coverage for critical paths must be at least 80%.
- All error scenarios must be handled gracefully.
- User-facing error messages must be clear and actionable.
