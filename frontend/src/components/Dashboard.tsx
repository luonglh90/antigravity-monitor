import React, { useState, useEffect } from "react";
import { vscode } from "../lib/vscode";
import { useAccount, AIModelQuota } from "../context/AccountContext";
import { Header } from "./Header";
import { ModelCard } from "./ModelCard";

export const Dashboard: React.FC = () => {
  const {
    currentAccount,
    setCurrentAccount,
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

  const accountRef = React.useRef(currentAccount);
  useEffect(() => {
    accountRef.current = currentAccount;
  }, [currentAccount]);

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
          console.log("[Dashboard] Account detected:", message.account);
          setCurrentAccount(message.account);
          setLoading(false);
          break;
        case "autoLoginFailed":
          console.log("[Dashboard] No local account detected");
          setCurrentAccount(null);
          setLoading(false);
          break;
        case "quotaData":
          if (message.data) {
            setQuota(message.data);
            if (message.data.models) {
              const recommendedOrder =
                message.data.recommendedModelLabels || [];

              const sortedModels = [...message.data.models].sort(
                (a: any, b: any) => {
                  const nameA = a.displayName || a.modelName;
                  const nameB = b.displayName || b.modelName;

                  const indexA = recommendedOrder.findIndex((label: string) =>
                    nameA.includes(label),
                  );
                  const indexB = recommendedOrder.findIndex((label: string) =>
                    nameB.includes(label),
                  );

                  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                  if (indexA !== -1) return -1;
                  if (indexB !== -1) return 1;

                  return nameA.localeCompare(nameB);
                },
              );
              setModels(sortedModels);
            }
            // Update planType in currentAccount metadata if it changed
            if (
              message.data.planType &&
              accountRef.current &&
              accountRef.current.metadata?.planType !== message.data.planType
            ) {
              setCurrentAccount({
                ...accountRef.current,
                metadata: {
                  ...accountRef.current.metadata,
                  planType: message.data.planType,
                },
              });
            }
          }
          setModelsLoading(false);
          break;
        case "quotaError":
          setError(message.error);
          setModelsLoading(false);
          break;
        case "error":
          setError(message.error);
          setLoading(false);
          break;
      }
    };

    window.addEventListener("message", messageHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, [setCurrentAccount, setQuota, setLoading, setError]);

  // Initial handshake
  useEffect(() => {
    if (!initialized) {
      console.log("[Dashboard] Initializing, sending webviewReady");
      setLoading(true);
      vscode.postMessage({ command: "webviewReady" });
      setInitialized(true);
    }
  }, [initialized, setLoading]);

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
          Initializing monitoring...
        </p>
      </div>
    );
  }

  if (!currentAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-4 bg-background">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-bold">No Local Account Detected</h3>
        <p className="text-muted-foreground max-w-xs">
          Please sign in to your AI assistant (e.g. Codeium) to use Antigravity
          Monitor.
        </p>
        <button
          onClick={() => vscode.postMessage({ command: "webviewReady" })}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Check Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background flex flex-col">
      <Header />

      <main className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Model Credits Section */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Model Credits
            </h2>
          </div>

          <div className="bg-card border border-border/50 rounded-xl shadow-sm">
            <div className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-sm font-bold text-foreground truncate">
                  AI Credits: {quota?.aiCredits ?? "—"}
                </span>
                <div className="relative group">
                  <div className="cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  {/* Custom Tooltip */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 p-2 bg-background/95 backdrop-blur-md border border-border rounded-lg shadow-xl text-[10px] leading-relaxed text-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
                    When toggled on, Antigravity will use your AI credits to
                    fulfill model requests once you're out of model quota.
                    Antigravity will always use your model quota first before
                    using AI credits.
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-8 border-transparent border-b-border/95" />
                  </div>
                </div>
              </div>

              {/* <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={() => {
                    const newValue = !quota?.enableAiCreditOverages;
                    console.log("[Dashboard] Toggling overages to:", newValue);
                    vscode.postMessage({
                      command: "toggleAiCreditOverages",
                      value: newValue,
                    });
                  }}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ring-1 ring-border/50 ${
                    quota?.enableAiCreditOverages ? "bg-primary" : "bg-muted/80"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      quota?.enableAiCreditOverages
                        ? "translate-x-5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div> */}
            </div>

            <div className="px-3 pb-3 flex items-center space-x-3">
              <a
                href={quota?.activityUri || "#"}
                target="_blank"
                className="text-[10px] font-bold text-muted-foreground hover:text-foreground hover:underline uppercase tracking-widest transition-colors"
              >
                Activity
              </a>
              <span className="text-border/50">|</span>
              <a
                href={quota?.upgradeUri || "#"}
                target="_blank"
                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest transition-colors"
              >
                Buy Credits
              </a>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">
            Model Quota
          </h2>
          {models.map((model, index) => (
            <ModelCard
              key={model.modelName}
              model={model}
              index={index}
              getRelativeResetTime={getRelativeResetTime}
            />
          ))}

          {modelsLoading && models.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-[11px] text-muted-foreground font-medium italic">
                Syncing quota data...
              </p>
            </div>
          )}

          {!modelsLoading && models.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-muted rounded-full">
                <svg
                  className="w-6 h-6 text-muted-foreground"
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
                <p className="text-xs text-foreground font-semibold">
                  No Data Found
                </p>
                <button
                  onClick={refreshQuotas}
                  className="mt-2 text-[10px] text-primary hover:underline font-bold"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
