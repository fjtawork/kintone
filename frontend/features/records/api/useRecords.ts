import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export interface AppRecord {
    id: string;
    record_number: number;
    data: Record<string, unknown>;
    status: string;
    created_at: string;
    updated_at: string;
}

export const useRecords = (appId: string, filters?: Record<string, unknown>) => {
    return useQuery({
        queryKey: ['records', appId, filters], // Include filters in query key to trigger refetch
        queryFn: async (): Promise<AppRecord[]> => {
            if (!appId) return [];
            const params: Record<string, string> = {};
            if (filters && Object.keys(filters).length > 0) {
                params.filters = JSON.stringify(filters);
            }
            const { data } = await api.get(`/records`, {
                params: {
                    app_id: appId,
                    ...params
                }
            });
            return data;
        },
        enabled: !!appId
    });
};
