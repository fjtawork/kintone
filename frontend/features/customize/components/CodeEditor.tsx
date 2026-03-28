'use client';

import Editor from '@monaco-editor/react';

interface CodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    language: 'php' | 'javascript';
    height?: string;
}

export function CodeEditor({ value, onChange, language, height = '500px' }: CodeEditorProps) {
    return (
        <Editor
            height={height}
            language={language}
            value={value}
            onChange={(val) => onChange(val ?? '')}
            theme="vs-dark"
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
            }}
        />
    );
}
