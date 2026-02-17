import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';

interface UpdateStatusPayload {
    recordId: string;
    action: string;
    nextAssigneeId?: string;
    comment?: string;
}

export const useUpdateRecordStatus = (appId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ recordId, action, nextAssigneeId, comment }: UpdateStatusPayload) => {
            const { data } = await api.post(`/records/${recordId}/workflow/actions/${encodeURIComponent(action)}`, {
                next_assignee_id: nextAssigneeId,
                comment
            });
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['records', appId] });
            queryClient.invalidateQueries({ queryKey: ['record'] });
        }
    });
};
