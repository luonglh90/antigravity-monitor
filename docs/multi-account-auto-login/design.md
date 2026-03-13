# Design: Multi-Account Auto-Login Feature

## Architecture Overview

The multi-account auto-login feature is implemented using a layered architecture:

1. **Backend Services Layer**: Credential storage, quota caching, and account management
2. **Backend Integration Layer**: Extension lifecycle hooks and message handlers
3. **Frontend State Management Layer**: React Context for global account state
4. **Frontend Component Layer**: UI components for account management and authentication

## Backend Architecture

### 1. CredentialStore Service

**File**: `backend/credentialStore.ts`

**Purpose**: Securely store and retrieve user credentials using VS Code's SecureStorage API.

**Interface**:
```typescript
interface CredentialStore {
  saveCredentials(email: string, token: string, metadata?: object): Promise<void>
  loadCredentials(email: string): Promise<Credentials | null>
  getAllCredentials(): Promise<Credentials[]>
  deleteCredentials(email: string): Promise<void>
}

interface Credentials {
  email: string
  token: string
  metadata?: {
    planType?: string
    lastLoginTime?: number
  }
}
```

**Implementation Details**:
- Uses VS Code's `context.secrets` for encryption
- Stores credentials with email as the key
- Implements fallback to in-memory storage on SecureStorage failure
- Handles storage errors gracefully with logging

### 2. QuotaCache Service

**File**: `backend/quotaCache.ts`

**Purpose**: Cache quota data per account with TTL-based expiration.

**Interface**:
```typescript
interface QuotaCache {
  setQuota(email: string, quotaData: object, ttlMs: number): void
  getQuota(email: string): object | null
  invalidateQuota(email: string): void
  clearAllQuotas(): void
}
```

**Implementation Details**:
- Stores quota data with email as the key
- Validates TTL on retrieval (default 5 minutes)
- Supports immediate invalidation for manual refresh
- Clears all entries on session cleanup

### 3. AccountManager Service

**File**: `backend/accountManager.ts`

**Purpose**: Manage account lifecycle including CRUD operations and active account tracking.

**Interface**:
```typescript
interface AccountManager {
  addAccount(email: string, token: string, metadata?: object): Promise<void>
  removeAccount(email: string): Promise<void>
  getAccount(email: string): Account | null
  getAllAccounts(): Account[]
  setActiveAccount(email: string): Promise<void>
  getActiveAccount(): Account | null
}

interface Account {
  email: string
  token: string
  metadata?: {
    planType?: string
    lastLoginTime?: number
  }
}
```

**Implementation Details**:
- Integrates with CredentialStore for persistence
- Detects and prevents duplicate account additions
- Updates last login time on account switch
- Maintains active account state in memory

### 4. LocalLanguageServerClient Enhancement

**File**: `backend/localLanguageServerClient.ts`

**Purpose**: Fetch credentials from the local language server for auto-login.

**New Method**:
```typescript
fetchCredentialsFromLanguageServer(): Promise<Credentials | null>
```

**Implementation Details**:
- Calls GetUserStatus on the language server
- Extracts email from response
- Returns credentials object with email and token
- Returns null if language server is unavailable
- Logs all attempts for debugging

### 5. QuotaService Enhancement

**File**: `backend/quotaService.ts`

**Purpose**: Fetch and cache quota data per account.

**New Method**:
```typescript
fetchQuotaForAccount(email: string): Promise<object>
```

**Implementation Details**:
- Accepts email parameter for per-account fetching
- Integrates with QuotaCache for caching
- Implements cache-first strategy with background refresh
- Handles errors with descriptive messages
- Supports cache invalidation on manual refresh

### 6. Extension Lifecycle Integration

**File**: `backend/extension.ts`

**Purpose**: Integrate auto-login flow with extension activation.

**Implementation Details**:
- On activation, attempt auto-login using language server credentials
- Implement retry logic with exponential backoff (up to 3 retries)
- Display loading indicator during auto-login
- Navigate to Dashboard on success
- Display Login component on failure
- Log all auto-login attempts

### 7. Message Handlers

**File**: `backend/extension.ts`

**Purpose**: Handle account operation messages from frontend.

**Message Types**:
- `addAccount`: Add a new account
- `switchAccount`: Switch to a different account
- `removeAccount`: Remove an account
- `fetchQuotas`: Fetch quota data for active account

**Implementation Details**:
- Validate account operations
- Update active account and trigger quota fetch on switch
- Clear session data when switching accounts
- Return success/error status to frontend

## Frontend Architecture

### 1. AccountContext

**File**: `frontend/src/context/AccountContext.tsx`

**Purpose**: Global state management for account data.

**Interface**:
```typescript
interface AccountContextType {
  currentAccount: Account | null
  accounts: Account[]
  loading: boolean
  error: string | null
  switchAccount(email: string): Promise<void>
  addAccount(email: string, token: string): Promise<void>
  removeAccount(email: string): Promise<void>
}

interface Account {
  email: string
  token: string
  metadata?: {
    planType?: string
    lastLoginTime?: number
  }
}
```

**Implementation Details**:
- Uses React Context API for global state
- Provides `useAccount()` hook for accessing state
- Manages account switching and list updates
- Handles loading and error states

### 2. useQuota Hook

**File**: `frontend/src/hooks/useQuota.ts`

**Purpose**: Manage quota data fetching and caching.

**Interface**:
```typescript
interface UseQuotaReturn {
  quota: object | null
  loading: boolean
  error: string | null
  refresh(): Promise<void>
}

function useQuota(email: string): UseQuotaReturn
```

**Implementation Details**:
- Fetches quota data for specified account
- Supports per-account quota caching
- Implements manual refresh functionality
- Handles background refresh with loading indicator
- Manages loading and error states

### 3. Message Handlers

**File**: `frontend/src/lib/messageHandlers.ts`

**Purpose**: Handle messages from backend.

**Message Types**:
- `updateAccount`: Update current account
- `quotaData`: Quota data update
- `quotaError`: Quota fetch error
- `accountList`: List of all accounts
- `accountSwitched`: Account switch confirmation
- `accountAdded`: New account added
- `accountRemoved`: Account removed

**Implementation Details**:
- Dispatches actions to update AccountContext
- Updates quota data in useQuota hook
- Handles error messages
- Triggers UI updates

### 4. Login Component Enhancement

**File**: `frontend/src/components/Login.tsx`

**Purpose**: Support both login and add-account modes.

**Props**:
```typescript
interface LoginProps {
  mode?: 'login' | 'add-account'
}
```

**Implementation Details**:
- Accepts mode prop (default: 'login')
- Changes button text based on mode
- Displays "Cancel" button in add-account mode
- Maintains consistent styling
- Sends appropriate command to extension

### 5. AccountSwitcher Component

**File**: `frontend/src/components/AccountSwitcher.tsx`

**Purpose**: Display and manage account switching.

**Features**:
- Displays current account email prominently
- Dropdown menu showing all available accounts
- Email display for each account
- Visual indication of active account
- "Add Account" button in dropdown
- "Remove" option for each account
- Auto-close dropdown after selection
- Single-account mode without dropdown

**Implementation Details**:
- Uses AccountContext for state
- Handles account selection and switching
- Manages dropdown visibility
- Provides account removal UI

### 6. Header Component Enhancement

**File**: `frontend/src/components/Header.tsx`

**Purpose**: Integrate AccountSwitcher and account management.

**Changes**:
- Include AccountSwitcher component
- Position AccountSwitcher prominently
- Add "Add Account" button next to AccountSwitcher
- Display plan type from account metadata
- Ensure UI doesn't interfere with main content

**Implementation Details**:
- Uses AccountContext for current account
- Handles "Add Account" button click
- Displays plan type in header

### 7. Dashboard Component Enhancement

**File**: `frontend/src/components/Dashboard.tsx`

**Purpose**: Manage multi-account state and auto-login flow.

**Changes**:
- Use AccountContext for account state
- Initialize account context on mount
- Handle auto-login flow with loading indicator
- Display Login component when no accounts available
- Display Dashboard when auto-login succeeds
- Support account switching with quota updates
- Handle quota fetch errors gracefully
- Implement background quota refresh

**Implementation Details**:
- Initializes AccountContext on mount
- Manages loading state during auto-login
- Handles account switching
- Integrates with useQuota hook

### 8. Application Layout

**File**: `frontend/src/app/layout.tsx`

**Purpose**: Wrap application with AccountProvider.

**Changes**:
- Wrap app with AccountProvider
- Ensure AccountContext is available to all components
- Initialize account state on app startup

## Data Flow

### Auto-Login Flow

1. Extension activates
2. `fetchCredentialsFromLanguageServer()` is called
3. If credentials found, `setActiveAccount()` is called
4. `fetchQuotaForAccount()` is called for active account
5. Dashboard component is displayed
6. If credentials not found or error occurs, Login component is displayed

### Account Switching Flow

1. User selects account from AccountSwitcher dropdown
2. `switchAccount()` message is sent to backend
3. Backend calls `setActiveAccount()` and updates last login time
4. Backend calls `fetchQuotaForAccount()` for new account
5. Backend sends `accountSwitched` message to frontend
6. Frontend updates AccountContext with new account
7. Dashboard component re-renders with new quota data

### Add Account Flow

1. User clicks "Add Account" button
2. Login component is displayed in add-account mode
3. User enters credentials and clicks "Add Account"
4. `addAccount` message is sent to backend
5. Backend validates and stores credentials
6. Backend sends `accountAdded` message to frontend
7. Frontend updates AccountContext with new account
8. New account appears in AccountSwitcher

### Remove Account Flow

1. User clicks "Remove" option for an account
2. `removeAccount` message is sent to backend
3. Backend deletes credentials and cached quota data
4. If removed account was active, backend switches to another account
5. Backend sends `accountRemoved` message to frontend
6. Frontend updates AccountContext
7. If last account removed, Login component is displayed

## Caching Strategy

### Quota Cache

- **TTL**: 5 minutes (configurable)
- **Strategy**: Cache-first with background refresh
- **Invalidation**: Manual refresh or account switch
- **Fallback**: Display cached data while fetching fresh data

### Credential Cache

- **Storage**: VS Code SecureStorage (encrypted)
- **Scope**: Per-account
- **Invalidation**: On account removal
- **Fallback**: In-memory storage if SecureStorage fails

## Error Handling

### Credential Store Errors

- Log error with context
- Fallback to in-memory storage
- Display user-friendly error message

### Account Operation Errors

- Validate input before operation
- Catch and log errors
- Return error status to frontend
- Display user-friendly error message

### Language Server Unavailability

- Return null from `fetchCredentialsFromLanguageServer()`
- Display Login component
- Allow manual authentication

### Quota Fetch Errors

- Display cached data if available
- Show error message with retry option
- Log error for debugging

## Security Considerations

1. **Credential Storage**: All credentials encrypted using VS Code SecureStorage
2. **Credential Transmission**: Credentials only transmitted over secure channels
3. **Session Isolation**: Session data cleared when switching accounts
4. **Error Messages**: Credentials never exposed in error messages
5. **Logging**: Sensitive data not logged

## Testing Strategy

### Unit Tests

- CredentialStore: Save, load, delete, error handling
- QuotaCache: Set, get, TTL validation, invalidation
- AccountManager: Add, remove, switch, metadata updates
- Login component: Mode prop, button text, command sending
- AccountSwitcher: Dropdown, account selection, removal
- Header component: AccountSwitcher integration, plan type display
- Dashboard component: Auto-login flow, account switching

### Property-Based Tests

1. **Retry Logic**: Exponential backoff pattern, max retries respected
2. **Account Isolation**: Data isolation across switches, no data leakage
3. **Cache TTL**: Expiration after TTL, immediate invalidation
4. **Credential Security**: Encryption before storage, no plaintext storage

### Integration Tests

- Auto-login flow: Extension activation to dashboard
- Account switching: UI to quota update
- Add account: Button click to dashboard
- Remove account: Confirmation to account removal
- Error scenarios: Network failures, API errors, missing data

## Performance Considerations

1. **Quota Cache**: Reduces API calls by 80%+ for typical usage
2. **Background Refresh**: Fetches fresh data without blocking UI
3. **Account Switching**: Completes within 500ms
4. **Component Re-renders**: Optimized with React.memo where appropriate

## Future Enhancements

1. Account preferences (default account, auto-switch)
2. Account activity history
3. Quota usage analytics
4. Account sharing and collaboration
5. Advanced caching strategies (LRU, adaptive TTL)
