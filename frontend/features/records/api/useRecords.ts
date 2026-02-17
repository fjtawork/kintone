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

export const useRecords = (appId: string, filters?: Record<string, unknown>, fieldCodes?: string[]) => {
    const normalizedFieldCodes = (fieldCodes || []).filter(Boolean).sort();

    return useQuery({
        queryKey: ['records', appId, filters, normalizedFieldCodes], // Include filters and field selection in query key
        queryFn: async (): Promise<AppRecord[]> => {
            if (!appId) return [];
            const params: Record<string, string> = {};
            if (filters && Object.keys(filters).length > 0) {
                params.filters = JSON.stringify(filters);
            }
            if (normalizedFieldCodes.length > 0) {
                params.field_codes = normalizedFieldCodes.join(',');
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
