import RecordPageClient from './RecordPageClient';

export function generateStaticParams() {
  return [{ id: '_', recordId: '_' }];
}

export default function RecordPage() {
  return <RecordPageClient />;
}
