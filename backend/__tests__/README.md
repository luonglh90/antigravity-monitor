# Backend Tests Documentation

This directory contains comprehensive tests for the multi-account auto-login feature backend services.

## Test Structure

### Unit Tests

Unit tests verify specific examples and edge cases for individual services:

#### 1. **credentialStore.test.ts**
Tests the CredentialStore service for secure credential storage and retrieval.

**Coverage:**
- Save and load credentials with email and token
- Metadata storage (planType, lastLoginTime)
- Error handling for missing email/token
- Credential deletion
- Multiple account support
- Credential isolation between accounts

**Requirements Validated:** 3.1, 3.2, 3.3, 3.4, 3.5

#### 2. **quotaCache.test.ts**
Tests the QuotaCache service for quota data caching with TTL management.

**Coverage:**
- Set and retrieve quota data
- Default TTL (5 minutes)
- Custom TTL support
- Cache expiration after TTL
- Cache invalidation
- Clear all quotas
- Multiple account isolation
- Cache updates

**Requirements Validated:** 15.1, 15.2, 15.3, 15.4

#### 3. **accountManager.test.ts**
Tests the AccountManager service for account lifecycle management.

**Coverage:**
- Initialize with stored accounts
- Add accounts with duplicate detection
- Remove accounts
- Get specific account
- Get all accounts
- Set active account
- Get active account
- Last login time updates
- Account isolation
- Active account switching

**Requirements Validated:** 3.1, 3.2, 3.3, 3.4, 4.3, 4.6, 8.3, 9.1, 9.2, 9.3, 9.4

#### 4. **quotaService.test.ts**
Tests the QuotaService for per-account quota fetching and caching.

**Coverage:**
- Fetch quota for account
- Cache integration
- Force refresh
- Background refresh
- Quota invalidation
- Get cached quota
- Clear all quotas
- Per-account quota isolation
- Error handling
- Cache TTL respect

**Requirements Validated:** 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 15.1, 15.2, 15.5

#### 5. **localLanguageServerClient.test.ts**
Tests the LocalLanguageServerClient for credential fetching from language server.

**Coverage:**
- Detect language server process
- Fetch credentials from language server
- Handle missing language server
- Extract email from response
- Error handling
- Logging

**Requirements Validated:** 2.1, 2.2, 2.3, 2.4, 2.5

### Property-Based Tests

Property-based tests verify universal properties that should hold across all inputs using fast-check:

#### 1. **autoLoginRetry.property.test.ts**
Tests auto-login retry logic with exponential backoff.

**Properties Tested:**
- Retry attempts increase with exponential backoff
- Maximum retry limit of 3 is respected
- Retries stop on successful authentication
- Correct delays calculated for all retry attempts
- Edge cases (0 retries, 1 retry, success on first/last attempt)

**Requirements Validated:** 11.1, 11.2

#### 2. **accountIsolation.property.test.ts**
Tests account data isolation across switches.

**Properties Tested:**
- Account data remains isolated across switches
- Metadata is not leaked between accounts
- Account list integrity maintained
- Last login time updated on switch
- Metadata not carried over from previous account
- Active account always matches displayed data
- Account removal maintains isolation
- Quota data isolation (simulated)

**Requirements Validated:** 12.1, 12.2, 12.3, 12.6

#### 3. **quotaCacheTTL.property.test.ts**
Tests quota cache TTL expiration and invalidation.

**Properties Tested:**
- Cache entries expire correctly after TTL
- Expired data is not returned
- Custom TTL values respected
- Default TTL used when not specified
- Expired data consistently returns null
- Cache invalidation works immediately
- Multiple accounts maintain separate TTLs
- Cache update resets TTL
- Clear all quotas removes all entries
- TTL boundary conditions (very small, very large, zero)

**Requirements Validated:** 15.1, 15.3, 15.4

#### 4. **credentialSecurity.property.test.ts**
Tests credential storage security and encryption.

**Properties Tested:**
- Credentials stored as JSON (structured format)
- Plaintext credentials never stored
- Credentials encrypted with metadata
- Decryption works correctly
- Data integrity through save/load cycle
- Credential isolation across accounts
- Secure deletion of credentials
- Other credentials unaffected on deletion
- Storage key generation is consistent
- Fallback to in-memory storage maintains security
- Credential validation (empty email/token rejected)

**Requirements Validated:** 3.5, 12.4

## Running Tests

### Prerequisites

```bash
npm install
npm install --save-dev fast-check ts-node
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npx mocha out/__tests__/credentialStore.test.js
npx mocha out/__tests__/autoLoginRetry.property.test.js
```

### Run Tests in Watch Mode

```bash
npm run watch-tests
```

## Test Coverage

The test suite provides comprehensive coverage of:

1. **Unit Tests**: 50+ test cases covering specific examples and edge cases
2. **Property-Based Tests**: 40+ property tests with 100+ generated test cases each
3. **Integration Points**: Message passing, account switching, quota fetching
4. **Error Scenarios**: Network failures, missing data, invalid inputs
5. **Security**: Credential encryption, data isolation, secure deletion

## Test Patterns

### Unit Test Pattern

```typescript
describe('ServiceName', () => {
  let service: ServiceName;

  beforeEach(() => {
    service = new ServiceName();
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = service.method(input);

    // Assert
    assert.strictEqual(result, 'expected');
  });
});
```

### Property-Based Test Pattern

```typescript
describe('Property Name', () => {
  it('should verify property across all inputs', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer(),
        (str, num) => {
          // Property that should hold for all inputs
          assert(someProperty(str, num));
        }
      )
    );
  });
});
```

## Key Testing Principles

1. **Isolation**: Each test is independent and doesn't affect others
2. **Clarity**: Test names clearly describe what is being tested
3. **Coverage**: Both happy path and error cases are tested
4. **Properties**: Universal properties are verified with property-based tests
5. **Mocking**: External dependencies are mocked for unit tests
6. **Assertions**: Clear assertions with meaningful error messages

## Continuous Integration

Tests are run automatically on:
- Pre-commit (via lint script)
- Pull requests
- Before packaging for release

## Troubleshooting

### Tests fail with "Cannot find module 'vscode'"

This is expected when running tests outside of VS Code environment. Use the VS Code test runner:

```bash
npx @vscode/test-electron
```

### Property-based tests are slow

Property-based tests generate many test cases. To reduce test count:

```typescript
fc.assert(
  fc.property(..., (args) => {
    // test
  }),
  { numRuns: 100 } // Reduce from default 100
);
```

### Tests timeout

Increase timeout in test configuration:

```typescript
describe('Slow tests', function() {
  this.timeout(10000); // 10 seconds
  
  it('should complete', () => {
    // test
  });
});
```

## Future Improvements

1. Add frontend component tests
2. Add integration tests for end-to-end flows
3. Add performance benchmarks
4. Add visual regression tests
5. Increase property-based test coverage
6. Add mutation testing for test quality

## References

- [Mocha Documentation](https://mochajs.org/)
- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing](https://hypothesis.works/articles/what-is-property-based-testing/)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extensions)
