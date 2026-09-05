import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  children,
  ...props
}) => {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border";

  const variants = {
    default: "bg-slate-800 text-slate-300 border-slate-700",
    success: "bg-emerald-950/60 text-emerald-300 border-emerald-800/80",
    warning: "bg-amber-950/60 text-amber-300 border-amber-800/80",
    danger: "bg-rose-950/60 text-rose-300 border-rose-800/80",
    info: "bg-indigo-950/60 text-indigo-300 border-indigo-800/80",
    outline: "bg-transparent text-slate-400 border-slate-700"
  };

  return (
    <span className={twMerge(clsx(base, variants[variant], className))} {...props}>
      {children}
    </span>
  );
};
