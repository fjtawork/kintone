import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface PinnedApp {
    sort_order: number;
    id: string;
    name: string;
    description: string;
    icon: string;
    theme: string;
}

export const usePinnedApps = () => {
    return useQuery<PinnedApp[]>({
        queryKey: ['pinnedApps'],
        queryFn: async () => {
            const { data } = await api.get('/users/me/pinned-apps');
            return data;
        },
    });
};

export const useUpdatePinnedApps = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (appIds: string[]) => {
            const { data } = await api.put('/users/me/pinned-apps', { app_ids: appIds });
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pinnedApps'] }),
    });
};
