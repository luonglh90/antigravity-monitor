# Implementation Plan: Multi-Account Auto-Login Feature

## Overview

This implementation plan breaks down the multi-account auto-login feature into discrete, manageable coding tasks. The feature adds automatic authentication using local language server credentials and enables users to manage multiple Antigravity accounts within the VS Code extension.

The implementation follows a logical progression:
1. Backend infrastructure services (credential storage, quota caching, account management)
2. Backend integration with extension lifecycle and message handling
3. Frontend state management and context setup
4. Frontend component modifications and new components
5. Testing and validation

## Tasks

- [x] 1. Create Credential Store service with VS Code SecureStorage integration
  - Create `backend/credentialStore.ts` with secure credential persistence
  - Implement `saveCredentials(email, token, metadata)` method
  - Implement `loadCredentials(email)` method
  - Implement `getAllCredentials()` method to list all stored accounts
  - Implement `deleteCredentials(email)` method
  - Use VS Code's `context.secrets` for encryption
  - Handle storage errors gracefully with fallback to in-memory storage
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 12.4_

- [x] 2. Create Quota Cache service with TTL management
  - Create `backend/quotaCache.ts` with per-account quota caching
  - Implement `setQuota(email, quotaData, ttlMs)` method
  - Implement `getQuota(email)` method with TTL validation
  - Implement `invalidateQuota(email)` method
  - Implement `clearAllQuotas()` method for session cleanup
  - Support 5-minute default TTL per requirement 15.6
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 3. Create Account Manager service with account lifecycle management
  - Create `backend/accountManager.ts` with account CRUD operations
  - Implement `addAccount(email, token, metadata)` method with duplicate detection
  - Implement `removeAccount(email)` method
  - Implement `getAccount(email)` method
  - Implement `getAllAccounts()` method
  - Implement `setActiveAccount(email)` method
  - Implement `getActiveAccount()` method
  - Integrate with CredentialStore for persistence
  - Update last login time on account switch (requirement 9.4)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 4.6, 8.3, 9.1, 9.2, 9.3, 9.4_

- [x] 4. Modify LocalLanguageServerClient to fetch credentials for auto-login
  - Add `fetchCredentialsFromLanguageServer()` method to `backend/localLanguageServerClient.ts`
  - Extract user email from GetUserStatus response
  - Return credentials object with email and authentication token
  - Handle missing language server gracefully (return null)
  - Log all attempts for debugging (requirement 11.4)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 5. Modify QuotaService to support per-account quota fetching and caching
  - Update `backend/quotaService.ts` to accept email parameter in `fetchQuotaForAccount()`
  - Integrate with QuotaCache service for caching
  - Implement cache invalidation on manual refresh
  - Support background refresh while displaying cached data (requirement 15.2)
  - Add error handling with descriptive messages (requirement 10.5)
  - _Requirements: 7.1, 7.5, 7.6, 15.1, 15.2, 15.5_

- [x] 6. Implement auto-login flow in extension.ts
  - Add auto-login attempt on extension activation
  - Call `fetchCredentialsFromLanguageServer()` to get initial credentials
  - Implement retry logic with exponential backoff (up to 3 retries per requirement 11.1)
  - Display loading indicator during auto-login (requirement 1.6)
  - Navigate to Dashboard on success (requirement 1.3)
  - Display Login component on failure (requirement 1.4, 1.5)
  - Log all auto-login attempts (requirement 11.4)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 11.1, 11.2, 11.3, 11.4_

- [x] 7. Add message handlers for account operations (add, switch, remove)
  - Add handler for `addAccount` message from frontend
  - Add handler for `switchAccount` message from frontend
  - Add handler for `removeAccount` message from frontend
  - Validate account operations and return success/error status
  - Update active account and trigger quota fetch on switch
  - Clear session data when switching accounts (requirement 12.2)
  - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4, 8.1, 8.2, 8.3, 8.4, 8.5, 10.1, 10.2, 10.3, 12.2_

- [x] 8. Implement quota fetching with caching strategy
  - Modify `fetchQuotas` message handler to use active account
  - Check cache first before making API call
  - Display cached data immediately while fetching fresh data in background
  - Implement background refresh with subtle loading indicator
  - Handle quota fetch errors with user-friendly messages
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.1, 15.2, 15.5_

- [x] 9. Add error handling and retry logic for backend operations
  - Implement error handling for credential store failures (requirement 3.6)
  - Implement error handling for account operations (requirement 10.1, 10.2, 10.3)
  - Implement error handling for language server unavailability (requirement 10.4)
  - Implement error handling for quota fetch failures (requirement 10.5)
  - Create user-friendly error messages with corrective actions
  - Log all errors for debugging
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 10. Create Account Context for frontend global state management
  - Create `frontend/src/context/AccountContext.tsx` with React Context
  - Define account state interface with current account, all accounts, loading state
  - Implement `AccountProvider` component
  - Implement `useAccount()` hook for accessing account state
  - Support account switching and list updates
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 11. Create hooks for quota data management
  - Create `frontend/src/hooks/useQuota.ts` hook
  - Implement quota fetching with loading and error states
  - Support per-account quota caching
  - Implement manual refresh functionality
  - Handle background refresh with loading indicator
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.1, 15.2, 15.5_

- [x] 12. Implement message handlers for backend communication
  - Create `frontend/src/lib/messageHandlers.ts` for backend communication
  - Implement handler for `updateAccount` message
  - Implement handler for `quotaData` message
  - Implement handler for `quotaError` message
  - Implement handler for `accountList` message
  - Implement handler for `accountSwitched` message
  - Implement handler for `accountAdded` message
  - Implement handler for `accountRemoved` message
  - _Requirements: 4.1, 4.2, 4.3, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4_

- [x] 13. Modify Login component to accept mode prop and support add-account mode
  - Update `frontend/src/components/Login.tsx` to accept `mode` prop ("login" | "add-account")
  - Change button text based on mode (requirement 6.2, 6.3)
  - Add "Cancel" button for add-account mode (requirement 6.4)
  - Maintain consistent styling for both modes (requirement 6.5)
  - Send appropriate command to extension based on mode (requirement 6.6)
  - Handle authentication response and navigate appropriately
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 14. Create AccountSwitcher component with dropdown and account management
  - Create `frontend/src/components/AccountSwitcher.tsx` component
  - Display current account email prominently (requirement 5.1)
  - Implement dropdown menu showing all available accounts (requirement 5.2, 5.3)
  - Display email for each account (requirement 5.5)
  - Indicate currently active account (requirement 5.6)
  - Add "Add Account" button in dropdown (requirement 4.1)
  - Add "Remove" option for each account (requirement 8.1)
  - Handle account selection and trigger switch (requirement 5.4)
  - Auto-close dropdown after selection (requirement 13.4)
  - Support single-account mode without dropdown (requirement 14.1)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 13.1, 13.2, 13.3, 13.4, 14.1_

- [x] 15. Update Header component to integrate AccountSwitcher
  - Modify `frontend/src/components/Header.tsx` to include AccountSwitcher
  - Position AccountSwitcher prominently in header (requirement 13.1)
  - Make AccountSwitcher accessible with single click (requirement 13.2)
  - Add "Add Account" button next to AccountSwitcher (requirement 4.1, 13.5)
  - Ensure account management UI doesn't interfere with main content (requirement 13.6)
  - Display plan type from account metadata (requirement 9.5)
  - _Requirements: 4.1, 5.1, 9.5, 13.1, 13.2, 13.5, 13.6_

- [x] 16. Update Dashboard component to manage multi-account state
  - Modify `frontend/src/components/Dashboard.tsx` to use AccountContext
  - Initialize account context on component mount
  - Handle auto-login flow with loading indicator (requirement 1.6)
  - Display Login component when no accounts available (requirement 1.4)
  - Display Dashboard when auto-login succeeds (requirement 1.3)
  - Support account switching with quota data updates (requirement 7.1, 7.2, 7.3)
  - Handle quota fetch errors gracefully (requirement 7.4)
  - Implement background quota refresh (requirement 15.2)
  - _Requirements: 1.3, 1.4, 1.6, 7.1, 7.2, 7.3, 7.4, 15.2_

- [x] 17. Wrap application with AccountProvider
  - Update `frontend/src/app/layout.tsx` to wrap app with AccountProvider
  - Ensure AccountContext is available to all components
  - Initialize account state on app startup
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 18. Checkpoint - Verify backend infrastructure and frontend state management
  - Ensure all backend services compile without errors
  - Verify AccountContext and hooks work correctly
  - Test message passing between backend and frontend
  - Verify account data persists correctly
  - Ask the user if questions arise.

- [x] 19. Write unit tests for CredentialStore service
  - Create `backend/__tests__/credentialStore.test.ts`
  - Test `saveCredentials()` with valid data
  - Test `loadCredentials()` for existing and non-existing accounts
  - Test `getAllCredentials()` returns all stored accounts
  - Test `deleteCredentials()` removes account data
  - Test error handling for storage failures
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 20. Write unit tests for QuotaCache service
  - Create `backend/__tests__/quotaCache.test.ts`
  - Test `setQuota()` and `getQuota()` with TTL validation
  - Test cache expiration after TTL
  - Test `invalidateQuota()` removes cached data
  - Test `clearAllQuotas()` clears all cache entries
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [x] 21. Write unit tests for AccountManager service
  - Create `backend/__tests__/accountManager.test.ts`
  - Test `addAccount()` with duplicate detection
  - Test `removeAccount()` and account switching
  - Test `getActiveAccount()` returns correct account
  - Test `getAllAccounts()` returns all accounts
  - Test last login time updates on switch
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.3, 4.6, 8.3, 9.1, 9.4_

- [x] 22. Write unit tests for Login component
  - Create `frontend/src/components/__tests__/Login.test.tsx`
  - Test mode prop changes button text correctly
  - Test "Cancel" button appears in add-account mode
  - Test login command sent to extension
  - Test add-account command sent to extension
  - Test loading state during authentication
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 23. Write unit tests for AccountSwitcher component
  - Create `frontend/src/components/__tests__/AccountSwitcher.test.tsx`
  - Test dropdown displays all accounts
  - Test account selection triggers switch
  - Test "Add Account" button functionality
  - Test "Remove" option for each account
  - Test single-account mode without dropdown
  - Test active account indication
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 8.1, 14.1_

- [x] 24. Write unit tests for Header component
  - Create `frontend/src/components/__tests__/Header.test.tsx`
  - Test AccountSwitcher integration
  - Test "Add Account" button visibility
  - Test plan type display
  - Test refresh button functionality
  - _Requirements: 4.1, 5.1, 9.5, 13.1, 13.2, 13.5_

- [x] 25. Write unit tests for Dashboard component
  - Create `frontend/src/components/__tests__/Dashboard.test.tsx`
  - Test auto-login flow with loading indicator
  - Test Login component display on failure
  - Test Dashboard display on success
  - Test account switching with quota updates
  - Test error handling for quota fetch failures
  - _Requirements: 1.3, 1.4, 1.6, 7.1, 7.2, 7.3, 7.4_

- [x] 26. Write property-based tests for auto-login retry logic
  - Create `backend/__tests__/autoLoginRetry.property.test.ts`
  - **Property 1: Retry attempts increase with exponential backoff**
  - **Validates: Requirements 11.1, 11.2**
  - Test that retry delays follow exponential backoff pattern
  - Test that max retries (3) is respected
  - Test that success on any attempt stops retries
  - _Requirements: 11.1, 11.2_

- [x] 27. Write property-based tests for account isolation
  - Create `backend/__tests__/accountIsolation.property.test.ts`
  - **Property 2: Account data remains isolated across switches**
  - **Validates: Requirements 12.1, 12.2, 12.3**
  - Test that switching accounts clears previous session data
  - Test that quota data from one account doesn't leak to another
  - Test that active account always matches displayed data
  - _Requirements: 12.1, 12.2, 12.3, 12.6_

- [x] 28. Write property-based tests for quota cache TTL
  - Create `backend/__tests__/quotaCacheTTL.property.test.ts`
  - **Property 3: Cache entries expire correctly after TTL**
  - **Validates: Requirements 15.1, 15.3, 15.4**
  - Test that cached data is returned before TTL expires
  - Test that expired data is not returned
  - Test that cache invalidation works immediately
  - _Requirements: 15.1, 15.3, 15.4_

- [x] 29. Write property-based tests for credential storage security
  - Create `backend/__tests__/credentialSecurity.property.test.ts`
  - **Property 4: Credentials are always encrypted before storage**
  - **Validates: Requirements 3.5, 12.4**
  - Test that credentials are encrypted using VS Code SecureStorage
  - Test that plaintext credentials are never written to disk
  - Test that decryption works correctly for stored credentials
  - _Requirements: 3.5, 12.4_

- [x] 30. Checkpoint - Ensure all unit and property tests pass
  - Run all unit tests and verify they pass
  - Run all property-based tests and verify they pass
  - Verify test coverage for critical paths
  - Ask the user if questions arise.

- [x] 31. Write integration tests for auto-login flow
  - Create `backend/__tests__/autoLoginIntegration.test.ts`
  - Test complete auto-login flow from extension activation to dashboard
  - Test auto-login with language server available
  - Test auto-login with language server unavailable
  - Test auto-login with invalid credentials
  - Test retry logic with transient failures
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 11.1, 11.2, 11.3_

- [x] 32. Write integration tests for account switching
  - Create `frontend/src/components/__tests__/accountSwitching.integration.test.tsx`
  - Test complete account switch flow from UI to quota update
  - Test switching between multiple accounts
  - Test quota data updates correctly on switch
  - Test error handling during account switch
  - Test cache usage during account switch
  - _Requirements: 5.3, 5.4, 7.1, 7.2, 7.3, 7.4, 15.2_

- [x] 33. Write integration tests for add account flow
  - Create `frontend/src/components/__tests__/addAccount.integration.test.tsx`
  - Test complete add account flow from button click to dashboard
  - Test Login component in add-account mode
  - Test new account appears in AccountSwitcher
  - Test duplicate account detection
  - Test error handling during add account
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 34. Write integration tests for remove account flow
  - Create `frontend/src/components/__tests__/removeAccount.integration.test.tsx`
  - Test complete remove account flow with confirmation
  - Test account is removed from AccountSwitcher
  - Test switching to another account when active account is removed
  - Test Login component displays when last account is removed
  - Test cached quota data is cleared for removed account
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 35. Checkpoint - Ensure all integration tests pass
  - Run all integration tests and verify they pass
  - Verify end-to-end flows work correctly
  - Test error scenarios and edge cases
  - Ask the user if questions arise.

- [x] 36. Test error scenarios and edge cases
  - Test auto-login with corrupted local storage
  - Test account operations with network failures
  - Test quota fetch with API errors (429, 5xx)
  - Test account switching with missing quota data
  - Test removing account while quota is being fetched
  - Test adding duplicate account
  - Test language server unavailability during auto-login
  - Verify all error messages are user-friendly
  - _Requirements: 3.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 37. Performance optimization and testing
  - Verify quota cache reduces API calls
  - Test background refresh doesn't block UI
  - Verify account switching is responsive
  - Test memory usage with multiple accounts
  - Optimize component re-renders with React.memo where appropriate
  - _Requirements: 15.1, 15.2, 15.5_

- [x] 38. Update README with multi-account features
  - Add section describing multi-account capabilities
  - Document auto-login feature
  - Add instructions for adding and switching accounts
  - Document account removal
  - Add troubleshooting section for multi-account issues
  - _Requirements: All_

- [x] 39. Add inline code documentation
  - Add JSDoc comments to all backend services
  - Add JSDoc comments to all frontend components and hooks
  - Document message protocol between backend and frontend
  - Document error handling patterns
  - Document caching strategy
  - _Requirements: All_

- [x] 40. Final checkpoint - Ensure all tests pass and feature is complete
  - Run full test suite and verify all tests pass
  - Verify all requirements are met
  - Test complete user workflows
  - Verify error handling and edge cases
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- All backend services use TypeScript for type safety
- All frontend components use React hooks and context for state management
- Error handling is comprehensive with user-friendly messages
- Caching strategy improves performance while maintaining data freshness
