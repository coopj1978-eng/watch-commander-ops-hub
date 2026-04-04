import type { WatchUnit } from "~backend/profile/types";
import { Badge } from "./ui/badge";

interface WatchBadgeProps {
  watch: WatchUnit | string;
  className?: string;
}

const watchColors: Record<string, string> = {
  Green: "bg-green-600 text-white border-green-600",
  Red: "bg-red-600 text-white border-red-600",
  White: "bg-gray-100 text-gray-900 border-gray-300 dark:bg-gray-700/50 dark:text-gray-100 dark:border-gray-500",
  Blue: "bg-blue-600 text-white border-blue-600",
  Amber: "bg-amber-500 text-white border-amber-500",
};

export function WatchBadge({ watch, className }: WatchBadgeProps) {
  const colorClass = watchColors[watch] || "bg-gray-500 text-white";
  
  return (
    <Badge className={`${colorClass} ${className || ""}`}>
      {watch}
    </Badge>
  );
}

interface WatchDotProps {
  watch: WatchUnit | string;
  size?: "sm" | "md" | "lg";
}

const dotSizes = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
};

const dotColors: Record<string, string> = {
  Green: "bg-green-600",
  Red: "bg-red-600",
  White: "bg-gray-300 border border-gray-400 dark:bg-gray-500 dark:border-gray-400",
  Blue: "bg-blue-600",
  Amber: "bg-amber-500",
};

export function WatchDot({ watch, size = "md" }: WatchDotProps) {
  const colorClass = dotColors[watch] || "bg-gray-500";
  const sizeClass = dotSizes[size];
  
  return (
    <span className={`inline-block rounded-full ${colorClass} ${sizeClass}`} />
  );
}
