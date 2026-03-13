import React from "react";
import { useAccount } from "../context/AccountContext";
import { AccountSwitcher } from "./AccountSwitcher";

export const Header: React.FC = () => {
  const { currentAccount, quota, refreshQuotas } = useAccount();

  if (!currentAccount) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <span className="text-lg font-black italic">A</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              Antigravity Monitor
            </h1>
          </div>
          <span className="h-6 w-[1px] bg-border/50" />
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Active Plan:
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase">
              {quota?.planType || currentAccount.metadata?.planType || "Free"}
            </span>
          </div>
          {quota?.upgradeUri && (
            <a
              href={quota.upgradeUri}
              target="_blank"
              className="ml-2 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
            >
              Upgrade
            </a>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={refreshQuotas}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Data"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>

          <AccountSwitcher />
        </div>
      </div>
    </header>
  );
};
