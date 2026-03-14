import React, { createContext, useContext, useState } from "react";
import { vscode } from "../lib/vscode";

export interface Account {
  email: string;
  token: string;
  metadata?: {
    planType?: string;
    lastLoginTime?: number;
    name?: string;
  };
  name?: string;
}

export interface AIModelQuota {
  modelName: string;
  displayName?: string;
  remainingFraction: number;
  remainingPercent: number;
  resetTime: string | null;
  resetTimeMs: number | null;
}

export interface QuotaData {
  models: AIModelQuota[];
  promptCredits?: number;
  flowCredits?: number;
  upgradeUri?: string;
  planType?: string;
  expirationDate?: string;
  name?: string;
  upgradeText?: string;
}

export interface AccountContextType {
  currentAccount: Account | null;
  quota: QuotaData | null;
  loading: boolean;
  error: string | null;
  setCurrentAccount: (account: Account | null) => void;
  setQuota: (quota: QuotaData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  refreshQuotas: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshQuotas = React.useCallback(() => {
    vscode.postMessage({ command: "fetchQuotas" });
  }, []);

  const value = React.useMemo(
    () => ({
      currentAccount,
      quota,
      loading,
      error,
      setCurrentAccount,
      setQuota,
      setLoading,
      setError,
      refreshQuotas,
    }),
    [currentAccount, quota, loading, error, refreshQuotas],
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
};

export const useAccount = () => {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return context;
};
