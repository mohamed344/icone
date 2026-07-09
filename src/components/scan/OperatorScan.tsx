"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Scanner } from "@/components/scan/Scanner";
import { Badge } from "@/components/ui/Badge";
import type { WorkflowStage } from "@/lib/workflow";

export function OperatorScan({ stages }: { stages: WorkflowStage[] }) {
  const t = useT();

  return (
    <>
      <PageHeader title={t("op.title")} subtitle={t("op.subtitle")} />
      {stages.length === 0 ? (
        <Badge tone="warning" dot>
          {t("op.noStation")}
        </Badge>
      ) : (
        <Scanner stages={stages} lockEntity />
      )}
    </>
  );
}
