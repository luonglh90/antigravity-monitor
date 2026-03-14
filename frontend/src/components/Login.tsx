import React, { useState } from 'react';
import { vscode } from '../lib/vscode';
import { useAccount } from '../context/AccountContext';

export const Login: React.FC = () => {
  const { loading, setLoading, error, setError } = useAccount();
  const [localLoading, setLocalLoading] = useState(false);

  const handleLogin = () => {
    setLocalLoading(true);
    setLoading(true);
    setError(null);
    vscode.postMessage({ command: 'login' });
  };

  // Reset local loading if global loading stops or error occurs
  React.useEffect(() => {
    if (!loading) {
      setLocalLoading(false);
    }
  }, [loading]);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-6 px-8 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Antigravity Monitor</h1>
        <p className="text-muted-foreground">
          Monitor your AI model quotas and account status in real-time.
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {error && (
          <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md border border-destructive/20">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={localLoading}
          className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {localLoading ? (
            <>
              <span className="animate-spin mr-2">◌</span>
              <span>Connecting...</span>
            </>
          ) : (
            <span>Login with Google</span>
          )}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        Secure authentication via VS Code Google provider.
      </p>
    </div>
  );
};
