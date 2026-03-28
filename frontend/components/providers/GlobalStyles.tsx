'use client';

import { useEffect } from 'react';

/**
 * custom/style.css をランタイムに取得して <style> タグとして注入する。
 * ファイルが存在しない・空の場合は何もしない。
 */
export const GlobalStyles = () => {
    useEffect(() => {
        const styleId = 'custom-styles';
        if (document.getElementById(styleId)) return;

        const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? '';
        fetch(`${apiBase}/custom/style.css`, { cache: 'no-store' })
            .then((res) => {
                if (!res.ok) return null;
                return res.text();
            })
            .then((css) => {
                if (!css || css.trim() === '') return;
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = css;
                document.head.appendChild(style);
            })
            .catch(() => {
                // style.css が取得できなくても無視
            });
    }, []);

    return null;
};
