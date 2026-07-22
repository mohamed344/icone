import { locateCode } from "@/app/(app)/scan/actions";
import type { DictKey } from "@/lib/i18n";

/**
 * A friendly "not waiting here" message: if the scanned code exists elsewhere in
 * the pipeline, tell the operator where it currently is instead of a bare
 * "not found". Falls back to the station's own not-found text when unknown.
 */
export async function notFoundMessage(
  t: (k: DictKey) => string,
  code: string,
  fallbackKey: DictKey,
): Promise<string> {
  try {
    const { stage } = await locateCode(code);
    if (stage) return t("scan.foundAt").replace("{stage}", t(`stage.${stage}` as DictKey));
  } catch {
    /* ignore — fall back to the plain message */
  }
  return t(fallbackKey);
}
