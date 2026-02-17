import { api } from '@/lib/axios';

export interface NotificationItem {
    id: string;
    user_id: string;
    app_id?: string | null;
    record_id?: string | null;
    kind: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: string;
    read_at?: string | null;
    link_path?: string | null;
}

export interface NotificationListResponse {
    items: NotificationItem[];
    unread_count: number;
}

export const getNotifications = async (): Promise<NotificationListResponse> => {
    const { data } = await api.get('/notifications', { params: { limit: 20 } });
    return data;
};

export const markNotificationRead = async (notificationId: string): Promise<NotificationItem> => {
    const { data } = await api.patch(`/notifications/${notificationId}/read`);
    return data;
};

export const markAllNotificationsRead = async (): Promise<{ updated: number }> => {
    const { data } = await api.patch('/notifications/read-all');
    return data;
};
