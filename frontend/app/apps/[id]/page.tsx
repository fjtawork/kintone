import AppPageClient from './AppPageClient';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function AppPage() {
  return <AppPageClient />;
}
