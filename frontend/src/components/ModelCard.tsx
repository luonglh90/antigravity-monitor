import React, { useState } from "react";
import { AIModelQuota } from "../context/AccountContext";

interface ModelCardProps {
  model: AIModelQuota;
  index: number;
  getRelativeResetTime: (resetTime: string | null) => string | null;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  index,
  getRelativeResetTime,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const showTooltipAtBottom = index < 2;

  const getResetColor = (resetTime: string | null) => {
    if (!resetTime) return "text-primary";
    const now = new Date().getTime();
    const reset = new Date(resetTime).getTime();
    const diff = reset - now;

    if (diff <= 1000 * 60 * 60) return "text-emerald-500"; // < 1h (Imminent)
    if (diff <= 1000 * 60 * 60 * 6) return "text-primary"; // < 6h (Soon)
    if (diff <= 1000 * 60 * 60 * 12) return "text-primary/60"; // < 12h (Later)
    return "text-muted-foreground/90"; // > 12h (Distant)
  };

  return (
    <div
      className={`group bg-card border border-border/50 rounded-xl p-4 shadow-sm hover:border-primary/30 transition-all duration-200 relative ${isTooltipVisible ? "z-[60]" : "z-10"}`}
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                model.remainingPercent > 0
                  ? "bg-green-500 animate-pulse"
                  : "bg-destructive shadow-[0_0_5px_rgba(239,68,68,0.5)]"
              }`}
            />
            <p className="font-bold text-[11px] group-hover:text-primary transition-colors truncate">
              {model.displayName || model.modelName}
            </p>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-tight text-muted-foreground italic mt-0.5">
            <span
              className={`text-[10px] font-black italic mr-1.5 ${
                model.remainingPercent < 20
                  ? "text-destructive"
                  : model.remainingPercent < 50
                    ? "text-amber-500"
                    : "text-primary"
              }`}
            >
              {model.remainingPercent}%
            </span>
            {model.modelName}
          </p>
        </div>
        {model.resetTime && (
          <div className="text-right flex-shrink-0 ml-2">
            <p
              className={`text-[9px] font-black uppercase tracking-widest ${getResetColor(model.resetTime)}`}
            >
              {getRelativeResetTime(model.resetTime)}
            </p>
            <p className="text-[8px] font-bold text-muted-foreground mt-0.5">
              {new Date(model.resetTime).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden w-full">
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

      {/* Premium Tooltip */}
      {isTooltipVisible && (
        <div
          className={`absolute left-0 w-full min-w-[200px] bg-background/95 backdrop-blur-xl border border-primary/20 rounded-xl shadow-2xl z-50 p-3 animate-in fade-in duration-200 ${
            showTooltipAtBottom
              ? "top-full mt-2 slide-in-from-top-2"
              : "bottom-full mb-2 slide-in-from-bottom-2"
          }`}
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
              <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                Model Intelligence
              </span>
              <span
                className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${model.remainingPercent > 0 ? "bg-green-500/10 text-green-500" : "bg-destructive/10 text-destructive"}`}
              >
                {model.remainingPercent > 0 ? "AVAILABLE" : "DEPLETED"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="p-2 bg-muted/30 rounded-lg border border-border/40">
                <p className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">
                  Technical ID
                </p>
                <p className="text-[10px] font-mono font-bold text-foreground/90 truncate">
                  {model.modelName}
                </p>
              </div>

              <div className="flex space-x-2">
                <div className="flex-1 p-2 bg-muted/30 rounded-lg border border-border/40">
                  <p className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">
                    Remaining
                  </p>
                  <p
                    className={`text-xs font-black ${model.remainingPercent < 20 ? "text-destructive" : "text-foreground"}`}
                  >
                    {model.remainingPercent}%
                  </p>
                </div>
                {model.resetTime && (
                  <div className="flex-1 p-2 bg-muted/30 rounded-lg border border-border/40">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase mb-0.5">
                      Resets In
                    </p>
                    <p className="text-xs font-black text-primary">
                      {getRelativeResetTime(model.resetTime)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {model.resetTime && (
              <div className="pt-1.5 border-t border-border/50 flex justify-between items-center text-[8px] font-bold">
                <span className="text-muted-foreground uppercase">
                  Exact Reset Date:
                </span>
                <span className="text-foreground/80">
                  {new Date(model.resetTime).toLocaleString()}
                </span>
              </div>
            )}
          </div>
          {/* Tooltip Arrow */}
          {showTooltipAtBottom ? (
            <div className="absolute -top-1 left-6 w-2 h-2 bg-background border-t border-l border-primary/20 rotate-45" />
          ) : (
            <div className="absolute -bottom-1 left-6 w-2 h-2 bg-background border-b border-r border-primary/20 rotate-45" />
          )}
        </div>
      )}
    </div>
  );
};
