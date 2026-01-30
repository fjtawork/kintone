import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export type App = {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    created_at: string;
};

export const useApps = () => {
    return useQuery({
        queryKey: ['apps'],
        queryFn: async (): Promise<App[]> => {
            const { data } = await api.get('/apps');
            return data;
        },
    });
};
