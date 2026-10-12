'use client';

import Link from 'next/link';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import { Workflow, Sparkles } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link
            href="/dashboard"
            className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-700 transition font-bold text-xl"
            aria-label="FlowMind AI Início"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-slate-900 tracking-tight">FlowMind <span className="text-indigo-600">AI</span></span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition px-3 py-2 rounded-md hover:bg-slate-50"
            >
              Dashboard
            </Link>
            <Link
              href="/history"
              className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition px-3 py-2 rounded-md hover:bg-slate-50"
            >
              Histórico & Consumo
            </Link>
          </nav>
        </div>


        <div className="flex items-center space-x-4">
          <div className="hidden sm:block">
            <OrganizationSwitcher
              afterCreateOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: 'flex items-center',
                  organizationSwitcherTrigger: 'border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 text-sm font-medium',
                },
              }}
            />
          </div>
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: 'w-9 h-9',
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
