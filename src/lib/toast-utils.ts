import { toast as originalToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { type Toast } from "@/components/ui/use-toast";

// Extended toast with success and error methods
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
  }
};
