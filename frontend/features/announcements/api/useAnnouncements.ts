import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface Announcement {
    id: string;
    title: string;
    body: string;
    is_pinned: boolean;
    created_by: string;
    created_at: string;
    updated_at: string | null;
}

export const useAnnouncements = () => {
    return useQuery<Announcement[]>({
        queryKey: ['announcements'],
        queryFn: async () => {
            const { data } = await api.get('/announcements');
            return data;
        },
    });
};

export const useCreateAnnouncement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { title: string; body: string; is_pinned: boolean }) => {
            const { data } = await api.post('/announcements', payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
    });
};

export const useUpdateAnnouncement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...payload }: { id: string; title: string; body: string; is_pinned: boolean }) => {
            const { data } = await api.put(`/announcements/${id}`, payload);
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
    });
};

export const useDeleteAnnouncement = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/announcements/${id}`);
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
    });
};
