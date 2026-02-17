'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { api } from '@/lib/axios';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { AxiosError } from 'axios';

export default function SignupPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const extractErrorMessage = (err: unknown) => {
        if (!(err instanceof AxiosError)) return '登録に失敗しました';
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail)) return detail.map((item) => item?.msg).filter(Boolean).join(', ') || '登録に失敗しました';
        return '登録に失敗しました';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/signup', {
                email: email.trim(),
                password,
                full_name: fullName
            });

            // Auto login after signup
            const body = new URLSearchParams();
            body.append('username', email.trim());
            body.append('password', password);

            const { data } = await api.post('/auth/login', body.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            login(data.access_token);

        } catch (err: unknown) {
            if (!(err instanceof AxiosError) || (err.response?.status ?? 0) >= 500) {
                console.error(err);
            }
            setError(extractErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-zinc-900">
            <Card className="w-[350px]">
                <CardHeader>
                    <CardTitle>新規登録</CardTitle>
                    <CardDescription>新しいアカウントを作成します。</CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent>
                        <div className="grid w-full items-center gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email">メールアドレス</Label>
                                <Input
                                    id="email"
                                    placeholder="name@example.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="fullname">氏名</Label>
                                <Input
                                    id="fullname"
                                    placeholder="山田 太郎"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="password">パスワード</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                        <Button className="w-full" type="submit" disabled={loading}>
                            {loading ? '作成中...' : '登録する'}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                            すでにアカウントをお持ちですか？ <Link href="/login" className="underline">ログイン</Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
