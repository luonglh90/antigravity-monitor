import React, { useState, useEffect } from "react";
import { vscode } from "../lib/vscode";
import { useAccount, AIModelQuota } from "../context/AccountContext";
import { Login } from "./Login";
import { Header } from "./Header";

export const Dashboard: React.FC = () => {
  const {
    currentAccount,
    setCurrentAccount,
    setAccounts,
    quota,
    setQuota,
    loading,
    setLoading,
    setError,
    refreshQuotas,
  } = useAccount();

  const [initialized, setInitialized] = useState(false);
  const [models, setModels] = useState<AIModelQuota[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Message handler
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log("[Dashboard] Received message:", message.command);

      switch (message.command) {
        case "autoLoginStarted":
          setLoading(true);
          break;
        case "autoLoginSuccess":
          console.log("[Dashboard] Auto-login success:", message.account);
          setCurrentAccount(message.account);
          setLoading(false);
          break;
        case "autoLoginFailed":
          console.log("[Dashboard] Auto-login failed");
          setLoading(false);
          break;
        case "loginSuccess":
          console.log("[Dashboard] Manual login success:", message.account);
          setCurrentAccount(message.account);
          setLoading(false);
          break;
        case "quotaData":
          if (message.data) {
            setQuota(message.data);
            if (message.data.models) {
              updateModels(message.data.models);
            }
            // Update planType in currentAccount metadata if it changed
            if (
              message.data.planType &&
              currentAccount &&
              currentAccount.metadata?.planType !== message.data.planType
            ) {
              setCurrentAccount({
                ...currentAccount,
                metadata: {
                  ...currentAccount.metadata,
                  planType: message.data.planType,
                },
              });
            }
          }
          setModelsLoading(false);
          break;
        case "accountAdded":
          console.log("[Dashboard] Account added:", message.account);
          setCurrentAccount(message.account);
          break;
        case "accountRemoved":
          console.log(
            "[Dashboard] Account removed, new active:",
            message.account,
          );
          setCurrentAccount(message.account);
          if (message.quota) {
            setQuota(message.quota);
            updateModels(message.quota.models || []);
          } else {
            setQuota(null);
            updateModels([]);
          }
          break;
        case "accountSwitched":
          console.log("[Dashboard] Account switched:", message.account);
          setCurrentAccount(message.account);
          if (message.quota) {
            setQuota(message.quota);
            updateModels(message.quota.models || []);
          } else {
            setQuota(null);
            updateModels([]);
          }
          setLoading(false);
          break;
        case "quotaError":
          setError(message.error);
          setModelsLoading(false);
          break;
        case "error":
          setError(message.error);
          setLoading(false);
          break;
        case "updateAccounts":
        case "accountList":
          setAccounts(message.accounts || []);
          break;
      }
    };

    const updateModels = (models: any[]) => {
      const sortedModels = [...models].sort((a, b) =>
        b.modelName.localeCompare(a.modelName),
      );
      setModels(sortedModels);
    };

    window.addEventListener("message", messageHandler);

    // Initial handshake
    if (!initialized) {
      console.log("[Dashboard] Initializing, sending webviewReady");
      setLoading(true);
      vscode.postMessage({ command: "webviewReady" });
      setInitialized(true);
    }

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [initialized, setCurrentAccount, setAccounts, setLoading, setError]);

  // Periodic quota refresh
  useEffect(() => {
    if (currentAccount) {
      setModelsLoading(true);
      refreshQuotas();

      const interval = setInterval(() => {
        refreshQuotas();
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [currentAccount, refreshQuotas]);

  const getRelativeResetTime = (resetTime: string | null) => {
    if (!resetTime) return null;
    const now = new Date().getTime();
    const reset = new Date(resetTime).getTime();
    const diff = reset - now;

    if (diff <= 0) return "reseting soon";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    let result = "";
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    result += `${minutes}m`;

    return result;
  };

  if (loading && !currentAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 bg-background">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        </div>
        <p className="text-muted-foreground animate-pulse font-medium">
          Initializing accounts...
        </p>
      </div>
    );
  }

  if (!currentAccount) {
    return <Login />;
  }

  return (
    <div className="min-h-full bg-background flex flex-col">
      <Header />

      <main className="flex-1 p-6 space-y-8 overflow-y-auto">
        <div className="flex justify-between items-end pt-8 mt-4">
          <div>
            <h4 className="text-2xl font-bold tracking-tight">
              AI Models Quota
            </h4>
            <p className="text-muted-foreground">
              Monitor your API usage limits and remaining quota.
            </p>
          </div>
          <button
            onClick={refreshQuotas}
            className={`p-2 rounded-full hover:bg-secondary transition-all ${modelsLoading ? "animate-spin text-primary" : "text-muted-foreground"}`}
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
        </div>

        <section className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden transition-all">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/20">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground w-1/3">
                    AI Model
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground w-1/3">
                    Remaining Quota
                  </th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-muted-foreground w-1/3">
                    Auto-Reset
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {models.map((model) => (
                  <tr
                    key={model.modelName}
                    className="group hover:bg-secondary/10 transition-colors duration-200"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-2 h-2 rounded-full ${model.remainingPercent > 0 ? "bg-green-500 animate-pulse" : "bg-destructive shadow-[0_0_5px_rgba(var(--destructive),0.5)]"}`}
                        />
                        <div>
                          <p className="font-bold text-base group-hover:text-primary transition-colors">
                            {model.displayName || model.modelName}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground italic">
                            {model.modelName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-2 max-w-[280px]">
                        <div className="flex justify-between items-center mb-1">
                          <span
                            className={`text-xs font-black italic ${
                              model.remainingPercent < 20
                                ? "text-destructive"
                                : model.remainingPercent < 50
                                  ? "text-amber-500"
                                  : "text-primary"
                            }`}
                          >
                            {model.remainingPercent}%
                          </span>
                        </div>
                        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden w-full">
                          <div
                            className={`h-full transition-all duration-1000 ease-out ${
                              model.remainingPercent < 20
                                ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                : model.remainingPercent < 50
                                  ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                  : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                            }`}
                            style={{ width: `${model.remainingPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {model.resetTime ? (
                        <div className="space-y-1">
                          <div className="flex items-center text-sm font-medium text-foreground">
                            <svg
                              className="w-3.5 h-3.5 mr-2 text-muted-foreground"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            {new Date(model.resetTime).toLocaleDateString()}
                          </div>
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest">
                            {getRelativeResetTime(model.resetTime)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-muted-foreground italic">
                          No Reset Info
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {modelsLoading && models.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground font-medium italic">
                Retrieving real-time quota data...
              </p>
            </div>
          )}

          {!modelsLoading && models.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-muted rounded-full">
                <svg
                  className="w-8 h-8 text-muted-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-foreground font-semibold">
                  No Quota Data Found
                </p>
                <p className="text-sm text-muted-foreground">
                  Try refreshing or check your connection.
                </p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
