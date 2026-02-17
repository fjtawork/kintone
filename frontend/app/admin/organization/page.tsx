'use client';

import { DepartmentList } from '@/features/organization/components/DepartmentList';
import { JobTitleList } from '@/features/organization/components/JobTitleList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function OrganizationPage() {
    return (
        <div className="container mx-auto py-8 px-4">
            <h1 className="text-3xl font-bold mb-2">組織設定</h1>
            <p className="text-muted-foreground mb-8">部署と役職を管理します。</p>

            <Tabs defaultValue="departments" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="departments">部署</TabsTrigger>
                    <TabsTrigger value="job-titles">役職</TabsTrigger>
                </TabsList>

                <TabsContent value="departments">
                    <DepartmentList />
                </TabsContent>

                <TabsContent value="job-titles">
                    <JobTitleList />
                </TabsContent>
            </Tabs>
        </div>
    );
}
