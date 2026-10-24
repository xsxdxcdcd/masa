"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, Role } from '@/lib/auth-context';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: Role[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isReady, setIsReady] = useState(false);

    // Every caller passes an inline literal (`allowedRoles={['ADMIN']}`), so the
    // array is a new reference on each render. Depending on it directly would
    // re-arm the timer on every render; the contents are what actually matter.
    const rolesKey = allowedRoles ? allowedRoles.join(',') : '';

    useEffect(() => {
        const allowed = rolesKey ? (rolesKey.split(',') as Role[]) : undefined;

        // Delay rendering to allow useAuth context to hydrate from localStorage
        const timer = setTimeout(() => {
            if (!isAuthenticated) {
                router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            } else if (allowed && !user) {
                // A token with no readable user object: the role cannot be
                // confirmed, so the safe answer is no.
                //
                // `isAuthenticated` is derived from the token alone while `user`
                // comes from a separate localStorage entry, so "token present,
                // user missing or corrupt" is a reachable state. Treating it as
                // allowed -- which this used to do, because the guard was written
                // `user && ...` -- would hand a role-gated page to anyone whose
                // role could not be read.
                router.push('/unauthorized');
            } else if (allowed && user && !allowed.includes(user.role)) {
                router.push('/unauthorized');
            } else {
                setIsReady(true);
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [isAuthenticated, user, rolesKey, router, pathname]);

    if (!isReady) {
        return <div className="flex items-center justify-center h-screen font-bold text-gray-500">Checking Authorization...</div>;
    }

    return <>{children}</>;
}
