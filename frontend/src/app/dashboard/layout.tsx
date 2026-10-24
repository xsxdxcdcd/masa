import React from 'react';
import Sidebar from '@/components/Sidebar';
import MobileSidebar from '@/components/MobileSidebar';
import ThemeToggle from '@/components/ThemeToggle';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <ProtectedRoute>
            <div className="flex min-h-screen bg-gray-50 dark:bg-brand-navy-dark">
                {/* Dynamic Sidebar handles its own Role checks */}
                <Sidebar />

                {/* Main Application Area wrapped securely */}
                <div className="flex-1 min-w-0">
                    <div className="h-1 bg-gradient-to-r from-brand-gold via-brand-gold/40 to-transparent" />
                    <div className="lg:hidden sticky top-0 z-40 bg-white/95 dark:bg-brand-navy/95 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-brand-gold/10 rounded-lg flex items-center justify-center">
                                <span className="text-brand-gold-dark dark:text-brand-gold-light font-black text-sm">L</span>
                            </div>
                            <span className="font-black text-brand-navy dark:text-white tracking-tight">
                                laxa<span className="text-brand-gold-dark dark:text-brand-gold-light">lab</span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <ThemeToggle />
                            <MobileSidebar />
                        </div>
                    </div>
                    <main className="p-4 sm:p-6 lg:p-8">
                        {children}
                    </main>
                </div>
            </div>
        </ProtectedRoute>
    );
}