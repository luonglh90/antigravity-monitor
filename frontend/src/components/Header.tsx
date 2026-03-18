import React, { useState } from "react";
import { vscode } from "../lib/vscode";
import { useAccount } from "../context/AccountContext";

export const Header: React.FC = () => {
  const { currentAccount, quota, refreshQuotas } = useAccount();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);

  if (!currentAccount) return null;

  const planType =
    quota?.planType || currentAccount.metadata?.planType || "Free";
  const isPro =
    planType.toLowerCase().includes("pro") ||
    planType.toLowerCase().includes("business");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <span className="text-base font-black italic">A</span>
            </div>
            <h1 className="text-sm font-bold tracking-tight hidden xs:block">
              Antigravity
            </h1>
          </div>
          <span className="h-5 w-[1px] bg-border/50" />
          <div className="flex flex-col items-start relative">
            <span className="text-[10px] font-bold text-foreground/70 truncate max-w-[100px] mb-0.5">
              {quota?.name || currentAccount.name || currentAccount.email}
            </span>
            <div
              className="flex items-center space-x-1.5 cursor-help group"
              onMouseEnter={() => setIsTooltipVisible(true)}
              onMouseLeave={() => setIsTooltipVisible(false)}
            >
              <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase ring-1 ring-primary/20 group-hover:bg-primary/20 transition-all">
                {planType}
              </span>
              {quota?.upgradeUri && (
                <a
                  href={quota.upgradeUri}
                  target="_blank"
                  className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-bold uppercase hover:bg-primary/90 transition-all"
                >
                  Upgrade
                </a>
              )}

              {/* Tooltip */}
              {isTooltipVisible && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-background/95 backdrop-blur-xl border border-primary/20 rounded-xl shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <span className="text-sm font-bold text-primary uppercase tracking-wider">
                        {planType} Plan
                      </span>
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Included Benefits
                      </p>
                      <ul className="space-y-1">
                        <li className="flex items-center text-xs text-foreground/90 font-medium">
                          <svg className="w-3 h-3 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          {isPro ? "Priority Model Access" : "Standard Model Access"}
                        </li>
                        <li className="flex items-center text-xs text-foreground/90 font-medium">
                          <svg className="w-3 h-3 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          {isPro ? "Unlimited Projects" : "Basic Project Support"}
                        </li>
                        <li className="flex items-center text-xs text-foreground/90 font-medium">
                          <svg className="w-3 h-3 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                          Real-time Quota Recovery
                        </li>
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
                        Usage Summary
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 bg-primary/5 rounded-lg border border-primary/10">
                          <p className="text-[10px] font-bold text-primary/70 uppercase">Prompts</p>
                          <p className="text-lg font-black text-primary leading-tight">{quota?.promptCredits ?? "—"}</p>
                        </div>
                        <div className="p-2 bg-muted/20 rounded-lg border border-border/50">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Flows</p>
                          <p className="text-lg font-black text-foreground leading-tight">{quota?.flowCredits ?? "—"}</p>
                        </div>
                      </div>
                    </div>

                    {quota?.upgradeText && (
                      <div className="pt-2 border-t border-border/50">
                        <p className="text-[9px] leading-relaxed text-muted-foreground italic font-medium">
                          {quota.upgradeText}
                        </p>
                      </div>
                    )}

                    {quota?.expirationDate && (
                      <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Plan Expires:</span>
                        <span className="text-[10px] font-bold text-foreground/90">{quota.expirationDate}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-background border-t border-l border-primary/20 rotate-45" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={refreshQuotas}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Data"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
