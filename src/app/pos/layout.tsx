import { Metadata } from "next";
import { DrawerStatusProvider } from "@/providers/drawer-status-provider";

export const metadata: Metadata = {
  title: "POS",
  description: "Point of Sale System",
};

interface PosLayoutProps {
  children: React.ReactNode;
}

export default function PosLayout({ children }: PosLayoutProps) {
  return (
    <DrawerStatusProvider>
      <div className="flex flex-col h-screen">
        {children}
      </div>
    </DrawerStatusProvider>
  );
}
