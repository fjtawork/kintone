import SettingsPageClient from './SettingsPageClient';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function SettingsPage() {
  return <SettingsPageClient />;
}
