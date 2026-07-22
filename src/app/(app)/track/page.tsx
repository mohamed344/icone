import { requireUser } from "@/lib/auth/session";
import { TrackConsole } from "@/components/scan/TrackConsole";

/** Track & trace: scan any box / carton / pallet to see everything inside it. */
export default async function TrackPage() {
  await requireUser();
  return <TrackConsole />;
}
