import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PreferredUnits, ProjectStatus, ValidationCheckStatus } from "@/types/cowpro";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFlow(lh: number | null | undefined, unit: PreferredUnits["flow"] = "L/h", digits = 2): string {
  if (lh === null || lh === undefined || Number.isNaN(lh)) return "—";
  if (unit === "m3/h") {
    return `${(lh / 1000).toFixed(Math.max(digits, 3))} m³/h`;
  }
  return `${lh.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })} L/h`;
}

export function formatPressure(bar: number | null | undefined, unit: PreferredUnits["pressure"] = "bar"): string {
  if (bar === null || bar === undefined || Number.isNaN(bar)) return "—";
  if (unit === "kPa") return `${(bar * 100).toFixed(1)} kPa`;
  if (unit === "psi") return `${(bar * 14.5038).toFixed(1)} psi`;
  return `${bar.toFixed(2)} bar`;
}

export function formatTemp(celsius: number | null | undefined, unit: PreferredUnits["temperature"] = "C"): string {
  if (celsius === null || celsius === undefined || Number.isNaN(celsius)) return "—";
  if (unit === "F") return `${((celsius * 9) / 5 + 32).toFixed(1)} °F`;
  return `${celsius.toFixed(1)} °C`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function projectStatusColor(status: ProjectStatus): string {
  switch (status) {
    case "Validated":
    case "Report Generated":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Validation Required":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Design Calculated":
    case "Input Complete":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function validationStatusColor(status: ValidationCheckStatus): string {
  switch (status) {
    case "Passed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Warning":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "Failed":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}
