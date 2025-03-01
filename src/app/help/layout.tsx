'use client';

import { HelpNavigation } from '@/components/help/HelpNavigation';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto grid grid-cols-12 gap-6 py-8">
      <div className="col-span-3">
        <HelpNavigation />
      </div>
      <div className="col-span-9">
        {children}
      </div>
    </div>
  );
}
