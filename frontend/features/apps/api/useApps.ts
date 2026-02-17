import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export type App = {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    permissions?: {
        app: { view: string[]; edit: string[]; delete: string[] };
        record: { view: string[]; edit: string[]; delete: string[] };
    };
    view_settings?: {
        list_fields?: string[];
    };
    user_permissions?: {
        view: boolean;
        edit: boolean;
        delete: boolean;
    };
    created_at: string;
};

export const useApps = (filters?: { created_by?: string }) => {
    return useQuery({
        queryKey: ['apps', filters],
        queryFn: async (): Promise<App[]> => {
            const { data } = await api.get('/apps', { params: filters });
            return data;
        },
    });
};
