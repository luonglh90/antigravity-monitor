import React, { createContext, useContext, useState, useEffect } from "react";
import { vscode } from "../lib/vscode";

export interface Account {
  email: string;
  token: string;
  metadata?: {
    planType?: string;
    lastLoginTime?: number;
  };
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
}

export interface AccountContextType {
  currentAccount: Account | null;
  accounts: Account[];
  quota: QuotaData | null;
  loading: boolean;
  error: string | null;
  setCurrentAccount: (account: Account | null) => void;
  setAccounts: (accounts: Account[]) => void;
  setQuota: (quota: QuotaData | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  switchAccount: (email: string) => void;
  addAccount: () => void;
  removeAccount: (email: string) => void;
  refreshQuotas: () => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchAccount = (email: string) => {
    setLoading(true);
    vscode.postMessage({ command: "switchAccount", email });
  };

  const addAccount = () => {
    vscode.postMessage({ command: "addAccount" });
  };

  const removeAccount = (email: string) => {
    vscode.postMessage({ command: "removeAccount", email });
  };

  const refreshQuotas = React.useCallback(() => {
    vscode.postMessage({ command: "fetchQuotas" });
  }, []);

  return (
    <AccountContext.Provider
      value={{
        currentAccount,
        accounts,
        quota,
        loading,
        error,
        setCurrentAccount,
        setAccounts,
        setQuota,
        setLoading,
        setError,
        switchAccount,
        addAccount,
        removeAccount,
        refreshQuotas,
      }}
    >
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
