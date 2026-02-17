'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api } from '@/lib/axios';

interface AuthContextType {
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Load token from localStorage
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            setToken(storedToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
    }, []);

    const login = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        router.push('/');
    };

    const logout = () => {
        setToken(null);
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        router.push('/login');
    };

    // Protected Routes Check
    useEffect(() => {
        const publicPaths = ['/login', '/signup'];
        if (!token && !publicPaths.includes(pathname) && typeof window !== 'undefined') {
            // Simple client-side protection. Middleware is better for Next.js but this suffices for SPA behavior.
            // We wait for initial mount (token load) check effectively by relying on initial null state?
            // Actually, if token is null initially, it might redirect before loading from LS.
            // Better strictly:
            const stored = localStorage.getItem('token');
            if (!stored && !publicPaths.includes(pathname)) {
                router.push('/login');
            }
        }
    }, [token, pathname, router]);

    return (
        <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
