"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings, User, Maximize2, Minimize2, Plus, Calculator } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useState, useEffect } from "react";
import CalculatorModal from "../pos/calculator-modal";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const handleCustomOrderClick = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('custom', 'true');
    router.push(url.pathname + url.search);
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <div className="text-xl font-bold">Pinewraps POS</div>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/pos"
                className={`text-sm font-medium ${
                  pathname === "/pos"
                    ? "text-black"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Point of Sale
              </Link>
              <Link
                href="/orders"
                className={`text-sm font-medium ${
                  pathname === "/orders"
                    ? "text-black"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Orders
              </Link>
              <Link
                href="/kitchen"
                className={`text-sm font-medium ${
                  pathname === "/kitchen"
                    ? "text-black"
                    : "text-gray-600 hover:text-black"
                }`}
              >
                Kitchen Display
              </Link>
            </nav>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {pathname === "/pos" && (
              <>
                <button
                  onClick={() => setIsCalculatorOpen(true)}
                  className="p-2 text-gray-600 hover:text-black transition-colors"
                  title="Calculator"
                >
                  <Calculator className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCustomOrderClick}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4" />
                  Custom Order
                </button>
              </>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-600 hover:text-black transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
            <div className="flex items-center text-gray-600">
              <User className="w-5 h-5 mr-2" />
              <span>{user?.name || user?.email}</span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />
    </header>
  );
}
