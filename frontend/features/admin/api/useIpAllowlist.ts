import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface IpEntry {
    id: string;
    label: string;
    cidr: string;
    is_active: boolean;
    created_by: string;
    created_at: string;
}

export const useIpAllowlist = () => {
    return useQuery<IpEntry[]>({
        queryKey: ['ipAllowlist'],
        queryFn: async () => {
            const { data } = await api.get('/admin/ip-allowlist');
            // API returns { ip_allowlist: [...] }
            return (data?.ip_allowlist ?? []) as IpEntry[];
        },
    });
};

export const useCreateIpEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { label: string; cidr: string }) => {
            const { data } = await api.post('/admin/ip-allowlist', payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ipAllowlist'] }),
    });
};

export const useToggleIpEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            const { data } = await api.patch(`/admin/ip-allowlist/${id}`, { is_active });
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ipAllowlist'] }),
    });
};

export const useDeleteIpEntry = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/admin/ip-allowlist/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ipAllowlist'] }),
    });
};
