import { useState } from 'react';
import { useUsers } from '../api/useUsers';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, User as UserIcon, Check } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface UserPickerProps {
    value?: string | string[]; // Single ID or array of IDs
    onChange: (value: string | string[]) => void;
    disabled?: boolean;
    multiSelect?: boolean;
}

export const UserPicker = ({ value, onChange, disabled, multiSelect = false }: UserPickerProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const { data: users, isLoading } = useUsers();

    const selectedIds = Array.isArray(value) ? value : (value ? [value] : []);

    const filteredUsers = users?.filter(user =>
        (user.full_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (userId: string) => {
        if (multiSelect) {
            if (selectedIds.includes(userId)) {
                onChange(selectedIds.filter(id => id !== userId));
            } else {
                onChange([...selectedIds, userId]);
            }
        } else {
            onChange(userId);
            setOpen(false);
        }
    };

    const getDisplayValue = () => {
        if (!users) return '';
        if (selectedIds.length === 0) return '';

        const selectedUsers = users.filter(u => selectedIds.includes(u.id));

        if (multiSelect) {
            // For multi, maybe just show count or list first few?
            // Since Input is small, let's render standard badges *outside* or just text inside
            // For simplicity in this input-like trigger, let's show comma separated names
            return selectedUsers.map(u => u.full_name || u.email).join(', ');
        } else {
            const user = selectedUsers[0];
            return user?.full_name || user?.email || '';
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex gap-2">
                    <Input
                        value={getDisplayValue()}
                        readOnly
                        placeholder="ユーザーを選択..."
                        disabled={disabled}
                        className="cursor-pointer"
                    />
                    <Button variant="outline" size="icon" disabled={disabled}>
                        <UserIcon className="h-4 w-4" />
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{multiSelect ? 'ユーザーを選択' : 'ユーザーを選択'}</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 my-4 relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="ユーザーを検索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <div className="flex-1 overflow-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>名前</TableHead>
                                <TableHead>メールアドレス</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">読み込み中...</TableCell>
                                </TableRow>
                            ) : filteredUsers?.map((user) => (
                                <TableRow
                                    key={user.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => handleSelect(user.id)}
                                >
                                    <TableCell>
                                        <div className={`flex items-center justify-center w-4 h-4 rounded-full border ${selectedIds.includes(user.id) ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'}`}>
                                            {selectedIds.includes(user.id) && <Check className="w-3 h-3" />}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium">{user.full_name || '-'}</TableCell>
                                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && filteredUsers?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center">ユーザーが見つかりません。</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {multiSelect && (
                    <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-muted-foreground">
                            {selectedIds.length} 件選択中
                        </div>
                        <Button onClick={() => setOpen(false)}>完了</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
