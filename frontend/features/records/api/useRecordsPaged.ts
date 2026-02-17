import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { AppRecord } from './useRecords';

interface RecordsPageResponse {
    items: AppRecord[];
    next_cursor: number | null;
    has_next: boolean;
}

export const useRecordsPaged = (appId: string, filters?: Record<string, unknown>, fieldCodes?: string[]) => {
    const normalizedFieldCodes = (fieldCodes || []).filter(Boolean).sort();

    return useInfiniteQuery({
        queryKey: ['records-infinite', appId, filters, normalizedFieldCodes],
        queryFn: async ({ pageParam }): Promise<RecordsPageResponse> => {
            if (!appId) {
                return { items: [], next_cursor: null, has_next: false };
            }

            const params: Record<string, string | number> = {
                app_id: appId,
                limit: 50,
            };
            if (typeof pageParam === 'number') {
                params.cursor = pageParam;
            }
            if (filters && Object.keys(filters).length > 0) {
                params.filters = JSON.stringify(filters);
            }
            if (normalizedFieldCodes.length > 0) {
                params.field_codes = normalizedFieldCodes.join(',');
            }

            const { data } = await api.get('/records/paged', { params });
            return data;
        },
        initialPageParam: undefined as number | undefined,
        getNextPageParam: (lastPage) => (lastPage.has_next ? (lastPage.next_cursor ?? undefined) : undefined),
        enabled: !!appId,
    });
};
