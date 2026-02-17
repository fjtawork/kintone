import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface Record {
    id: string;
    app_id: string;
    record_number: number;
    status: string;
    data: Record<string, unknown>; // JSONB
    created_at: string;
    updated_at: string;
    created_by: string;
    workflow_requester_id?: string | null;
    workflow_approver_ids: string[];
    workflow_history: {
        actor_id: string;
        action: string;
        comment?: string | null;
        at: string;
    }[];
}

export const useRecord = (recordId: string) => {
    return useQuery({
        queryKey: ['record', recordId],
        queryFn: async (): Promise<Record> => {
            const { data } = await api.get(`/records/${recordId}`);
            return data;
        },
        enabled: !!recordId
    });
};

export const useUpdateRecord = (appId: string, recordId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { data: Record<string, unknown> }) => {
            const { data: response } = await api.put(`/records/${recordId}`, payload);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['record', recordId] });
            queryClient.invalidateQueries({ queryKey: ['records', appId] });
        }
    });
};
