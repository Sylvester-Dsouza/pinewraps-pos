import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  if (!date) return ""
  const dateObj = typeof date === "string" ? new Date(date) : date
  return format(dateObj, "PPP") // e.g., April 21, 2025
}

export function formatShortDate(date: Date | string): string {
  if (!date) return ""
  const dateObj = typeof date === "string" ? new Date(date) : date
  return format(dateObj, "EEE, MMM d") // e.g., Mon, Apr 21
}

export function dateToISOString(date: Date): string {
  // Fix timezone issues by using local date methods instead of toISOString
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
