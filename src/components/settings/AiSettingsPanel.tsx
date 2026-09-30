import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiApiKeySettings } from "@/components/settings/AiApiKeySettings";
import { AiUsageDashboard } from "@/components/settings/AiUsageDashboard";
import { AiBudgetSettings } from "@/components/settings/AiBudgetSettings";
import { AiUsageLogsTable } from "@/components/settings/AiUsageLogsTable";

export function AiSettingsPanel() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="key" className="w-full">
        <TabsList className="w-full justify-start rounded-2xl bg-muted/30 p-1">
          <TabsTrigger value="key" className="rounded-xl">Kunci & Koneksi</TabsTrigger>
          <TabsTrigger value="usage" className="rounded-xl">Pemakaian</TabsTrigger>
          <TabsTrigger value="budget" className="rounded-xl">Budget & Proteksi</TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl">Log & Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="key" className="mt-4">
          <AiApiKeySettings />
        </TabsContent>
        <TabsContent value="usage" className="mt-4">
          <AiUsageDashboard />
        </TabsContent>
        <TabsContent value="budget" className="mt-4">
          <AiBudgetSettings />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AiUsageLogsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

