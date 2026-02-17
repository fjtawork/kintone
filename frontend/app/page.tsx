import { AppList } from '@/features/apps/components/AppList';

export default function Home() {
  return (
    <main className="container mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          ダッシュボード
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          <span className="font-semibold text-foreground">kintone Clone</span> のワークスペースへようこそ。
        </p>
      </div>
      <AppList />
    </main>
  );
}
