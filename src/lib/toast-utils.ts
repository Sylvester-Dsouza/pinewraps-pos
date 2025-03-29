import { toast as originalToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { ToastProps } from "@/components/ui/toast";

// Extended toast with success, error, warning, and info methods
export const toast = {
  ...originalToast,
  success: (message: string) => {
    return originalToast({
      title: "Success",
      description: message,
      variant: "default",
    });
  },
  error: (message: string) => {
    return originalToast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  },
  warning: (message: string) => {
    return originalToast({
      title: "Warning",
      description: message,
      variant: "destructive",
    });
  },
  info: (message: string) => {
    return originalToast({
      title: "Information",
      description: message,
      variant: "default",
    });
  }
};
