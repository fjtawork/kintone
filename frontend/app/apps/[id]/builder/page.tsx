import BuilderPageClient from './BuilderPageClient';

export function generateStaticParams() {
  return [{ id: '_' }];
}

export default function BuilderPage() {
  return <BuilderPageClient />;
}
