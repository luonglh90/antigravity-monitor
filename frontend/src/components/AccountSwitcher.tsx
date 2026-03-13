import React, { useState, useRef, useEffect } from "react";
import { useAccount } from "../context/AccountContext";

export const AccountSwitcher: React.FC = () => {
  const { 
    currentAccount, 
    accounts, 
    switchAccount, 
    removeAccount, 
    addAccount 
  } = useAccount();
  
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentAccount) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors border border-border/50"
      >
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground font-bold">
          {currentAccount.email.substring(0, 1).toUpperCase()}
        </div>
        <span className="text-sm font-medium truncate max-w-[150px]">
          {currentAccount.email}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Switch Account
            </div>
            {accounts.map((account) => (
              <div
                key={account.email}
                className="group flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <button
                  onClick={() => {
                    switchAccount(account.email);
                    setIsOpen(false);
                  }}
                  className="flex items-center space-x-3 flex-1 text-left"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    account.email === currentAccount.email 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {account.email.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-medium truncate ${
                      account.email === currentAccount.email ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {account.email}
                    </span>
                  </div>
                </button>
                
                {accounts.length > 1 && (
                  <button
                    onClick={() => removeAccount(account.email)}
                    className="p-1.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove Account"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <div className="p-2 border-t border-border bg-muted/30">
            <button
              onClick={() => {
                addAccount();
                setIsOpen(false);
              }}
              className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium"
            >
              <div className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="12 4v16m8-8H4" />
                </svg>
              </div>
              <span>Add another account</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
