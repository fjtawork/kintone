import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';

export type User = {
    id: string;
    email: string;
    full_name: string | null;
    is_active: boolean;
    is_superuser: boolean;
    department_id?: string; // Should match backend model
    job_title_id?: string;
};

export const useUsers = () => {
    return useQuery({
        queryKey: ['users'],
        queryFn: async (): Promise<User[]> => {
            const { data } = await api.get('/users');
            return data;
        },
    });
};
