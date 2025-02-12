"use client";

import { useState } from "react";
import { Menu, User, Bell, Settings, LayoutGrid, Receipt, History } from "lucide-react";
import Link from "next/link";

export default function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white h-16 flex items-center px-6 justify-between border-b">
        <div className="flex items-center space-x-6">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-xl"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold">Pinewraps POS</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-2 hover:bg-gray-100 rounded-xl relative">
            <Bell className="h-6 w-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-xl">
            <User className="h-6 w-6" />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-xl">
            <Settings className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* Sidebar */}
      {isSidebarOpen && (
        <>
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-2xl z-50 p-6">
            <div className="space-y-6">
              <div className="pb-6 border-b">
                <h2 className="font-semibold text-lg mb-1">Pinewraps POS</h2>
                <p className="text-sm text-gray-500">Point of Sale System</p>
              </div>
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl text-gray-700"
                >
                  <LayoutGrid className="h-5 w-5" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/orders"
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl text-gray-700"
                >
                  <Receipt className="h-5 w-5" />
                  <span>Orders</span>
                </Link>
                <Link
                  href="/history"
                  className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-xl text-gray-700"
                >
                  <History className="h-5 w-5" />
                  <span>History</span>
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
