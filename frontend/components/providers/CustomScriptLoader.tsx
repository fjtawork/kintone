'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

function getApiBase(): string {
    if (typeof window === 'undefined') return '';
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
        return envUrl.replace(/\/api\/v1\/?$/, '');
    }
    return '';
}

export function CustomScriptLoader() {
    const pathname = usePathname();

    // グローバルJS読み込み
    useEffect(() => {
        const script = document.createElement('script');
        script.src = `${getApiBase()}/api/v1/custom-js/global.js?t=${Date.now()}`;
        script.async = true;
        document.body.appendChild(script);

        return () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, []);

    // アプリ別JS読み込み
    useEffect(() => {
        const match = pathname.match(/^\/apps\/([^/]+)/);
        if (!match) return;

        const appId = match[1];
        if (appId === '_') return;

        const script = document.createElement('script');
        script.src = `${getApiBase()}/api/v1/custom-js/apps/${appId}.js?t=${Date.now()}`;
        script.async = true;
        document.body.appendChild(script);

        return () => {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        };
    }, [pathname]);

    return null;
}
