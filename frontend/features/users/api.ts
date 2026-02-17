import { api } from '@/lib/axios';

export interface User {
    id: string;
    email: string;
    full_name?: string;
    is_active: boolean;
    is_superuser: boolean;
    department_id?: string;
    job_title_id?: string;
    created_at: string;
}

export const getUsers = async (skip = 0, limit = 100): Promise<User[]> => {
    const { data } = await api.get('/users', { params: { skip, limit } });
    return data;
};

export const getCurrentUser = async (): Promise<User> => {
    const { data } = await api.get('/users/me');
    return data;
};

export const createUser = async (user: any): Promise<User> => {
    const { data } = await api.post('/users', user);
    return data;
};

export const updateUser = async (id: string, user: any): Promise<User> => {
    const { data } = await api.put(`/users/${id}`, user);
    return data;
};

export const deleteUser = async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
};
