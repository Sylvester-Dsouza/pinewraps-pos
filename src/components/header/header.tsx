"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Settings, User, Maximize2, Minimize2, Plus, Calculator, DollarSign, ListOrdered, Menu, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useState, useEffect, useRef } from "react";
import CalculatorModal from "../pos/calculator-modal";
import ConnectionStatus from "../connection-status";

interface HeaderProps {
  title?: string;
}

export default function Header({ title }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    // Close mobile menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  const navLinks = [
    { href: "/pos", label: "Point of Sale" },
    { href: "/orders", label: "Orders" },
    { href: "/pos/parked-orders", label: "Hold Orders"},
    { href: "/pos/till", label: "Till"},
    { href: "/printer", label: "Printer" },
    { href: "/kitchen", label: "Kitchen Display" },
    { href: "/design", label: "Design Display" },
    { href: "/final-check", label: "Final Check" },
  ];

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo and Navigation */}
          <div className="flex items-center gap-8">
            <div className="text-xl font-bold">{"PW"}</div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium flex items-center gap-1 ${
                    pathname === link.href
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            
            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2 text-gray-600 hover:text-black transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Connection Status */}
            <div className="hidden lg:block">
              <ConnectionStatus />
            </div>

            {pathname === "/pos" && (
              <>
                <button
                  onClick={() => setIsCalculatorOpen(true)}
                  className="p-2 text-gray-600 hover:text-black transition-colors"
                  title="Calculator"
                >
                  <Calculator className="w-5 h-5" />
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
            <div className="hidden sm:flex items-center text-gray-600">
              <User className="w-5 h-5 mr-2" />
              <span className="max-w-[100px] truncate">{user?.displayName || user?.email}</span>
            </div>
            <button
              onClick={signOut}
              className="flex items-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div 
          ref={mobileMenuRef}
          className="md:hidden absolute z-50 bg-white shadow-lg border border-gray-200 rounded-lg w-64 right-4 mt-2"
        >
          <nav className="py-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${
                  pathname === link.href
                    ? "bg-gray-100 text-primary"
                    : "text-muted-foreground hover:bg-gray-50 hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Calculator Modal */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
      />
    </header>
  );
}
