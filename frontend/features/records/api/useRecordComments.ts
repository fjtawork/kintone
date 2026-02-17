import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface RecordComment {
    id: string;
    record_id: string;
    user_id: string;
    user_name?: string | null;
    message: string;
    created_at: string;
}

export interface MentionCandidate {
    id: string;
    full_name?: string | null;
    email: string;
}

export const useRecordComments = (recordId: string, enabled: boolean) => {
    return useQuery({
        queryKey: ['record-comments', recordId],
        queryFn: async (): Promise<RecordComment[]> => {
            const { data } = await api.get(`/records/${recordId}/comments`, {
                params: { limit: 300 },
            });
            return data;
        },
        enabled: !!recordId && enabled,
        refetchInterval: enabled ? 15000 : false,
    });
};

export const useMentionCandidates = (
    recordId: string,
    query: string,
    enabled: boolean,
    limit = 8
) => {
    return useQuery({
        queryKey: ['record-mention-candidates', recordId, query],
        queryFn: async (): Promise<MentionCandidate[]> => {
            const { data } = await api.get(`/records/${recordId}/mention-candidates`, {
                params: { q: query, limit },
            });
            return data;
        },
        enabled: !!recordId && enabled,
        staleTime: 10_000,
    });
};

export const useCreateRecordComment = (recordId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (message: string): Promise<RecordComment> => {
            const { data } = await api.post(`/records/${recordId}/comments`, { message });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['record-comments', recordId] });
        },
    });
};
