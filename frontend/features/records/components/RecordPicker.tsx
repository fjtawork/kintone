import { useState } from 'react';
import { useRecords } from '../api/useRecords';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface RecordPickerProps {
    appId: string;
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const RecordPicker = ({ appId, value, onChange, disabled }: RecordPickerProps) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Fetch records from target app
    const { data: records, isLoading } = useRecords(appId, search ? { "data": { "$contains": search } } : undefined);

    // Helper to get a display string for a record (first value found)
    const getRecordDisplay = (record: any) => {
        if (!record?.data) return record?.id;
        const firstKey = Object.keys(record.data)[0];
        return record.data[firstKey] || record.id;
    };

    const selectedRecord = records?.find(r => r.id === value);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex gap-2">
                    <Input
                        value={selectedRecord ? getRecordDisplay(selectedRecord) : value || ''}
                        readOnly
                        placeholder="レコードを選択..."
                        disabled={disabled}
                        className="cursor-pointer"
                    />
                    <Button variant="outline" size="icon" disabled={disabled}>
                        <Search className="h-4 w-4" />
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>レコードを選択</DialogTitle>
                </DialogHeader>

                <div className="flex gap-2 my-4">
                    <Input
                        placeholder="検索..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>プレビュー</TableHead>
                                <TableHead>作成日</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">読み込み中...</TableCell>
                                </TableRow>
                            ) : records?.map((record) => (
                                <TableRow key={record.id}>
                                    <TableCell>{record.record_number}</TableCell>
                                    <TableCell>{getRecordDisplay(record)}</TableCell>
                                    <TableCell>{new Date(record.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell>
                                        <Button size="sm" onClick={() => {
                                            onChange(record.id);
                                            setOpen(false);
                                        }}>
                                            選択
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && records?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">レコードが見つかりません。</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
};
