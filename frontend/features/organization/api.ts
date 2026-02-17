import { api } from '@/lib/axios';

// Departments
export interface Department {
    id: string;
    name: string;
    code: string;
    created_at: string;
}

export const getDepartments = async (): Promise<Department[]> => {
    const { data } = await api.get('/organization/departments');
    return data;
};

export const createDepartment = async (dept: { name: string; code: string }): Promise<Department> => {
    const { data } = await api.post('/organization/departments', dept);
    return data;
};

export const updateDepartment = async (id: string, dept: { name?: string; code?: string }): Promise<Department> => {
    const { data } = await api.put(`/organization/departments/${id}`, dept);
    return data;
};

export const deleteDepartment = async (id: string): Promise<void> => {
    await api.delete(`/organization/departments/${id}`);
};

// Job Titles
export interface JobTitle {
    id: string;
    name: string;
    rank: number;
    created_at: string;
}

export const getJobTitles = async (): Promise<JobTitle[]> => {
    const { data } = await api.get('/organization/job_titles');
    return data;
};

export const createJobTitle = async (title: { name: string; rank: number }): Promise<JobTitle> => {
    const { data } = await api.post('/organization/job_titles', title);
    return data;
};

export const updateJobTitle = async (id: string, title: { name?: string; rank?: number }): Promise<JobTitle> => {
    const { data } = await api.put(`/organization/job_titles/${id}`, title);
    return data;
};

export const deleteJobTitle = async (id: string): Promise<void> => {
    await api.delete(`/organization/job_titles/${id}`);
};
