import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { QuestionMarkCircledIcon, LaptopIcon, PrinterIcon, InfoIcon } from '@/components/icons';

interface HelpNavigationProps {
  className?: string;
}

export function HelpNavigation({ className }: HelpNavigationProps) {
  const pathname = usePathname();
  
  const navItems = [
    {
      href: '/help',
      label: 'General Help',
      icon: QuestionMarkCircledIcon,
    },
    {
      href: '/help/mac-setup',
      label: 'Mac Setup Guide',
      icon: LaptopIcon,
    },
    {
      href: '/help/printer-setup',
      label: 'Printer Setup',
      icon: PrinterIcon,
    },
    {
      href: '/help/about',
      label: 'About',
      icon: InfoIcon,
    },
  ];
  
  return (
    <div className={cn("py-4", className)}>
      <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
        Help & Support
      </h2>
      <nav className="space-y-1 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                pathname === item.href 
                  ? "bg-accent text-accent-foreground" 
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
