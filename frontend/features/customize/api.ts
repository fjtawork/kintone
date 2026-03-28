import { api } from '@/lib/axios';

export async function getCustomPhp(): Promise<string> {
    const { data } = await api.get('/admin/custom-php');
    return data.code;
}

export async function updateCustomPhp(code: string): Promise<void> {
    await api.put('/admin/custom-php', { code });
}

export async function getGlobalJs(): Promise<string> {
    const { data } = await api.get('/admin/custom-js/global');
    return data.code;
}

export async function updateGlobalJs(code: string): Promise<void> {
    await api.put('/admin/custom-js/global', { code });
}

export async function getAppJs(appId: string): Promise<string> {
    const { data } = await api.get(`/apps/${appId}/custom-js`);
    return data.code;
}

export async function updateAppJs(appId: string, code: string): Promise<void> {
    await api.put(`/apps/${appId}/custom-js`, { code });
}
