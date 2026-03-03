import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg" | "none";
}

export function Card({ children, className = "", padding = "md", ...props }: CardProps) {
  const paddings = { sm: "p-4", md: "p-6", lg: "p-8", none: "" };
  return (
    <div
      className={`bg-surface rounded-xl border border-border shadow-sm ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
