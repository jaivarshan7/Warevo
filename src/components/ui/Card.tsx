import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  hoverEffect = false,
  children,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          "bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm shadow-black/20",
          hoverEffect && "hover:border-slate-700 hover:shadow-md transition-all duration-200",
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
