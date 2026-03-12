import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface SystemSettings {
    ip_restriction_enabled: boolean;
    signup_enabled: boolean;
    session_timeout_hours: number;
    organization_name: string;
}

export const useSystemSettings = () => {
    return useQuery<SystemSettings>({
        queryKey: ['adminSettings'],
        queryFn: async () => {
            const { data } = await api.get('/admin/settings');
            // API returns { settings: { ... } }
            return (data?.settings ?? {}) as SystemSettings;
        },
    });
};

export const useUpdateSystemSettings = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: Partial<SystemSettings>) => {
            // API expects { settings: { ... } }
            const { data } = await api.put('/admin/settings', { settings: payload });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
            queryClient.invalidateQueries({ queryKey: ['systemInfo'] });
        },
    });
};
