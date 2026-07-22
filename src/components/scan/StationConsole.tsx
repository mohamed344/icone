import { OperatorScan } from "@/components/scan/OperatorScan";
import { SfScanner } from "@/components/scan/SfScanner";
import { OtpScanner } from "@/components/scan/OtpScanner";
import { Qc1Scanner } from "@/components/scan/Qc1Scanner";
import { StageScanner } from "@/components/scan/StageScanner";
import { SerialLinkScanner } from "@/components/scan/SerialLinkScanner";
import { TestScanner } from "@/components/scan/TestScanner";
import { NgScanner } from "@/components/scan/NgScanner";
import { ReparationScanner } from "@/components/scan/ReparationScanner";
import { ReprintScanner } from "@/components/scan/ReprintScanner";
import { CartonScanner } from "@/components/scan/CartonScanner";
import { Qc2Scanner } from "@/components/scan/Qc2Scanner";
import { StockScanner } from "@/components/scan/StockScanner";
import {
  getOtpConfig,
  getLineConfig,
  getCurrentOtpBox,
  getOtpWaitingCount,
  regenerateLegacyBoxCodes,
} from "@/app/(app)/scan/otp-actions";
import { getQc1Queue } from "@/app/(app)/scan/qc1-actions";
import { getStageQueue } from "@/app/(app)/scan/stage-actions";
import {
  getModels,
  getCurrentCarton,
  getCartonWaitingCount,
  getQc2Queue,
  getQc2History,
  getStockWaitingCount,
  getRecentStockCartons,
  getHeldUnits,
} from "@/app/(app)/scan/carton-actions";
import { getUnitQueue } from "@/app/(app)/scan/unit-actions";
import type { WorkflowStage } from "@/lib/workflow";

/**
 * Renders the specialized scanner for a single workflow station, fetching its
 * initial data server-side. Shared by the operator (single-station) page and
 * the chef supervision console (station switcher). Steps without a dedicated
 * UI fall back to the generic scan panel.
 */
export async function StationConsole({ station }: { station: WorkflowStage }) {
  // ---- Step 1 (Scan PCBA): the 3-scan wizard (serial QR → operator → verify) ---
  if (station === "container_creation") {
    return <SfScanner />;
  }

  // ---- Box stations ----------------------------------------------------------
  if (station === "otp_validation") {
    await regenerateLegacyBoxCodes(); // self-heal old BX-… codes to the new format
    const [config, currentBox, waiting] = await Promise.all([
      getOtpConfig(),
      getCurrentOtpBox(),
      getOtpWaitingCount(),
    ]);
    return <OtpScanner config={config} initialBox={currentBox} initialWaiting={waiting} />;
  }

  if (station === "qc1_box") {
    const queue = await getQc1Queue();
    return <Qc1Scanner initialQueue={queue} />;
  }

  // ---- Reception (step 4): receive the whole BOX, then it dissolves into units.
  if (station === "reception") {
    const queue = await getStageQueue("reception");
    return <StageScanner stage="reception" initialQueue={queue} />;
  }

  // ---- Binding (step 5): two-scan carte↔dimo link ---------------------------
  if (station === "serial_linking") {
    return <SerialLinkScanner />;
  }

  // ---- Per-carte stations ----------------------------------------------------
  if (station === "scan_test") {
    const queue = await getUnitQueue("scan_test");
    return <TestScanner initialQueue={queue} />;
  }
  if (station === "ng_handling") {
    return <NgScanner />;
  }
  if (station === "reparation") {
    const queue = await getUnitQueue("reparation");
    return <ReparationScanner initialQueue={queue} />;
  }
  if (station === "rescan_reprint") {
    const queue = await getUnitQueue("rescan_reprint");
    return <ReprintScanner initialQueue={queue} />;
  }

  // ---- Scan PF (step 9): accumulate cartes into cartons ----------------------
  if (station === "carton_printing") {
    const [{ cartonSize }, models, currentCarton, waiting, held] = await Promise.all([
      getLineConfig(),
      getModels(),
      getCurrentCarton(),
      getCartonWaitingCount(),
      getHeldUnits(),
    ]);
    return (
      <CartonScanner
        cartonSize={cartonSize}
        models={models}
        initialCarton={currentCarton}
        initialWaiting={waiting}
        initialHeld={held}
      />
    );
  }

  // ---- Qualité 2 (step 10): approve/reject cartons from a list --------------
  if (station === "qc2_final") {
    const [queue, history] = await Promise.all([getQc2Queue(), getQc2History()]);
    return <Qc2Scanner initialQueue={queue} initialHistory={history} />;
  }

  // ---- Stock (step 11): receive by pallet or carton ------------------------
  if (station === "stock_entry") {
    const [waiting, recent] = await Promise.all([getStockWaitingCount(), getRecentStockCartons()]);
    return <StockScanner initialWaiting={waiting} initialRecent={recent} />;
  }

  // ---- Steps without a dedicated UI fall back to the generic scan panel -----
  return <OperatorScan stages={[station]} />;
}
