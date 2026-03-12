import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

const SETTINGS_KEY = 'announcement_content';
const QUERY_KEY = ['announcementContent'];

export const useAnnouncementContent = () => {
    return useQuery<string>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const { data } = await api.get('/admin/settings');
            return (data?.settings?.[SETTINGS_KEY] as string) ?? '';
        },
    });
};

export const useUpdateAnnouncementContent = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (content: string) => {
            const { data } = await api.put('/admin/settings', {
                settings: { [SETTINGS_KEY]: content },
            });
            return data;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    });
};
