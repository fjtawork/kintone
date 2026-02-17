'use client';

import { UserList } from '@/features/users/components/UserList';

export default function UsersPage() {
    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-2">ユーザー管理</h1>
            <p className="text-muted-foreground mb-8">システムユーザーと組織情報の紐付けを管理します。</p>

            <UserList />
        </div>
    );
}
