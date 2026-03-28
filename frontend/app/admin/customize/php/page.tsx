import PhpEditorClient from './PhpEditorClient';

export function generateStaticParams() {
    return [{}];
}

export default function PhpEditorPage() {
    return <PhpEditorClient />;
}
