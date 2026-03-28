import JsEditorClient from './JsEditorClient';

export function generateStaticParams() {
    return [{}];
}

export default function JsEditorPage() {
    return <JsEditorClient />;
}
