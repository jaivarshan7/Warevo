import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-primary text-white hover:bg-teal-800",
    secondary: "bg-white text-slate-900 border border-border hover:bg-slate-50",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
    danger: "bg-destructive text-white hover:bg-red-700"
  };
  return <button className={cn("inline-flex h-10 items-center gap-2 rounded px-4 text-sm font-medium transition", variants[variant], className)} {...props} />;
}
