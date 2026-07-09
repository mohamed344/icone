import { requireRole } from "@/lib/auth/session";
import { OperatorScan } from "@/components/scan/OperatorScan";
import { OtpScanner } from "@/components/scan/OtpScanner";
import { Qc1Scanner } from "@/components/scan/Qc1Scanner";
import { StageScanner } from "@/components/scan/StageScanner";
import { UnitStageScanner } from "@/components/scan/UnitStageScanner";
import { TestScanner } from "@/components/scan/TestScanner";
import { NgScanner } from "@/components/scan/NgScanner";
import { ReprintScanner } from "@/components/scan/ReprintScanner";
import { RepairedUnits } from "@/components/scan/RepairedUnits";
import { getOtpConfig, getCurrentOtpBox } from "@/app/(app)/scan/otp-actions";
import { getQc1Queue, getReworkBoxes } from "@/app/(app)/scan/qc1-actions";
import { getStageQueue } from "@/app/(app)/scan/stage-actions";
import { getUnitQueue, getRepairedUnits } from "@/app/(app)/scan/unit-actions";
import type { WorkflowStage } from "@/lib/workflow";

export default async function OperatorPage() {
  const { profile } = await requireRole(["operator"]);

  const allowed = profile?.allowed_stations ?? [];
  const stages: WorkflowStage[] = allowed.length
    ? allowed
    : profile?.station
      ? [profile.station]
      : [];
  const station = stages.length === 1 ? stages[0] : null;

  // ---- Box stations ----------------------------------------------------------
  if (station === "otp_validation") {
    const [config, currentBox, rework] = await Promise.all([
      getOtpConfig(),
      getCurrentOtpBox(),
      getReworkBoxes(),
    ]);
    return <OtpScanner config={config} initialBox={currentBox} initialRework={rework} />;
  }

  if (station === "qc1_box") {
    const queue = await getQc1Queue();
    return <Qc1Scanner initialQueue={queue} />;
  }

  if (station === "reception") {
    const [queue, repaired] = await Promise.all([getStageQueue("reception"), getRepairedUnits()]);
    return (
      <>
        <StageScanner stage="reception" initialQueue={queue} />
        <RepairedUnits initial={repaired} />
      </>
    );
  }

  // ---- Per-unit stations (steps 5–8) ----------------------------------------
  if (station === "serial_linking") {
    const queue = await getUnitQueue("serial_linking");
    return <UnitStageScanner stage="serial_linking" initialQueue={queue} />;
  }
  if (station === "scan_test") {
    const queue = await getUnitQueue("scan_test");
    return <TestScanner initialQueue={queue} />;
  }
  if (station === "ng_handling") {
    const queue = await getUnitQueue("ng_handling");
    return <NgScanner initialQueue={queue} />;
  }
  if (station === "rescan_reprint") {
    const queue = await getUnitQueue("rescan_reprint");
    return <ReprintScanner initialQueue={queue} />;
  }

  return <OperatorScan stages={stages} />;
}
