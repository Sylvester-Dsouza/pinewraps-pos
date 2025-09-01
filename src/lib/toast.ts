import { toast as sonnerToast } from "sonner";
import React from "react";

type CustomToastProps = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

// Define a simple options type that works with our implementation
type SimpleToastOptions = Record<string, any>;

// Extended toast with success, error, warning, and info methods
export const toast = {
  // Base toast function
  ...sonnerToast,
  
  // Success toast
  success: (message: string, options?: SimpleToastOptions) => {
    return sonnerToast.success(message, {
      duration: 4000,
      className: "bg-green-50 border-green-200 text-green-800",
      ...(options || {}),
    });
  },
  
  // Error toast
  error: (message: string, options?: SimpleToastOptions) => {
    return sonnerToast.error(message, {
      duration: 5000,
      className: "bg-red-50 border-red-200 text-red-800",
      ...(options || {}),
    });
  },
  
  // Warning toast
  warning: (message: string, options?: SimpleToastOptions) => {
    return sonnerToast.warning(message, {
      duration: 5000,
      className: "bg-yellow-50 border-yellow-200 text-yellow-800",
      ...(options || {}),
    });
  },
  
  // Info toast
  info: (message: string, options?: SimpleToastOptions) => {
    return sonnerToast.info(message, {
      duration: 4000,
      className: "bg-blue-50 border-blue-200 text-blue-800",
      ...(options || {}),
    });
  },
  
  // Loading toast
  loading: (message: string, options?: SimpleToastOptions) => {
    return sonnerToast.loading(message, {
      duration: Infinity, // Loading toasts should stay until dismissed
      ...(options || {}),
    });
  },
  
  // Dismiss method
  dismiss: sonnerToast.dismiss,
  
  // Custom toast (for compatibility with shadcn/ui toast)
  custom: (props: CustomToastProps) => {
    const { title, description, variant } = props;
    
    if (variant === "destructive") {
      return sonnerToast.error(description || "", {
        description: title,
      });
    }
    
    return sonnerToast(description || "", {
      description: title,
    });
  }
};

// For backward compatibility with shadcn/ui toast
export const useToast = () => {
  return {
    toast: {
      ...toast,
      // Add a custom function that mimics the shadcn/ui toast API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      custom: toast.custom,
    },
    // For compatibility with shadcn/ui toast
    dismiss: sonnerToast.dismiss,
  };
};

