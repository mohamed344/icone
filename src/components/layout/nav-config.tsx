import {
  ScanLine,
  LayoutDashboard,
  LineChart,
  Gauge,
  UsersRound,
  Settings,
  Factory,
  ShieldCheck,
  ListChecks,
  History,
  SlidersHorizontal,
  Warehouse,
  Link2,
  PackageX,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import type { DictKey } from "@/lib/i18n";
import type { Role } from "@/lib/auth/session";

export interface NavItem {
  href: string;
  labelKey: DictKey;
  icon: LucideIcon;
}
export interface NavGroup {
  titleKey: DictKey;
  items: NavItem[];
}

const SETTINGS_GROUP: NavGroup = {
  titleKey: "nav.section.system",
  items: [{ href: "/settings", labelKey: "nav.settings", icon: Settings }],
};

/** Navigation is role-scoped — each role sees only its own pages.
 * `canApproveRejected` surfaces the Rejected-cartons page to a delegated
 * non-admin user (admins always see it). */
export function navForRole(role: Role | undefined, canApproveRejected = false): NavGroup[] {
  switch (role) {
    case "admin":
      return [
        {
          titleKey: "nav.section.main",
          items: [
            { href: "/admin", labelKey: "nav.overview", icon: Gauge },
            { href: "/admin/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
            { href: "/admin/analytics", labelKey: "nav.analytics", icon: LineChart },
            { href: "/admin/stock", labelKey: "nav.stock", icon: Warehouse },
            { href: "/track", labelKey: "nav.track", icon: ScanSearch },
            { href: "/admin/links", labelKey: "nav.links", icon: Link2 },
            { href: "/admin/rejected", labelKey: "nav.rejected", icon: PackageX },
            { href: "/admin/employees", labelKey: "nav.employees", icon: UsersRound },
            { href: "/admin/roles", labelKey: "nav.roles", icon: ShieldCheck },
            { href: "/admin/workflow", labelKey: "nav.workflow", icon: ListChecks },
            { href: "/admin/config", labelKey: "nav.config", icon: SlidersHorizontal },
          ],
        },
        SETTINGS_GROUP,
      ];
    case "chef_de_ligne":
      return [
        {
          titleKey: "nav.section.main",
          items: [
            { href: "/chef", labelKey: "nav.line", icon: Factory },
            { href: "/track", labelKey: "nav.track", icon: ScanSearch },
            ...(canApproveRejected
              ? [{ href: "/admin/rejected", labelKey: "nav.rejected" as DictKey, icon: PackageX }]
              : []),
            { href: "/history", labelKey: "nav.history", icon: History },
          ],
        },
        SETTINGS_GROUP,
      ];
    default: // operator
      return [
        {
          titleKey: "nav.section.main",
          items: [
            { href: "/operator", labelKey: "nav.scan", icon: ScanLine },
            { href: "/track", labelKey: "nav.track", icon: ScanSearch },
            ...(canApproveRejected
              ? [{ href: "/admin/rejected", labelKey: "nav.rejected" as DictKey, icon: PackageX }]
              : []),
            { href: "/history", labelKey: "nav.history", icon: History },
          ],
        },
        SETTINGS_GROUP,
      ];
  }
}
