/**
 * Client-safe domain constants (no server-only imports) shared by forms,
 * scanners and the session helper. Mirrors the DB enums in 0001/0002.
 */
export const WORKFLOW_STAGES = [
  "container_creation",
  "otp_validation",
  "qc1_box",
  "reception",
  "serial_linking",
  "scan_test",
  "ng_handling",
  "rescan_reprint",
  "carton_printing",
  "qc2_final",
  "stock_entry",
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const ROLES = ["operator", "chef_de_ligne", "admin"] as const;
export type Role = (typeof ROLES)[number];

/** First per-unit stage: the box "dissolves" into individual products here. */
export const FIRST_UNIT_STAGE: WorkflowStage = "serial_linking";
/** Stages that operate on individual products (steps 5+). */
export const UNIT_STAGES: WorkflowStage[] = [
  "serial_linking",
  "scan_test",
  "ng_handling",
  "rescan_reprint",
  "carton_printing",
  "qc2_final",
  "stock_entry",
];

export const ENTITY_TYPES = ["container", "box", "item", "carton", "pallet", "group"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** What each step scans by default — used to keep the operator screen focused. */
export const STAGE_ENTITY: Record<WorkflowStage, EntityType> = {
  container_creation: "container",
  otp_validation: "container",
  qc1_box: "box",
  reception: "item",
  serial_linking: "item",
  scan_test: "item",
  ng_handling: "item",
  rescan_reprint: "box",
  carton_printing: "carton",
  qc2_final: "item",
  stock_entry: "pallet",
};

export const USER_STATUSES = ["active", "pending", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Capability flags the admin can grant per employee (app-level permissions). */
export const PERMISSIONS = [
  "scan",
  "override_qc",
  "bypass_sequence",
  "manage_stock",
  "create_containers",
  "view_reports",
  "manage_employees",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export type PermissionMap = Partial<Record<Permission, boolean>>;

/** Sensible defaults applied when the admin doesn't override them. */
export function defaultPermissions(role: Role): PermissionMap {
  switch (role) {
    case "admin":
      return Object.fromEntries(PERMISSIONS.map((p) => [p, true])) as PermissionMap;
    case "chef_de_ligne":
      return { scan: true, override_qc: true, manage_stock: true, view_reports: true };
    default:
      return { scan: true };
  }
}

export function hasPermission(
  perms: PermissionMap | null | undefined,
  key: Permission,
  role?: Role,
): boolean {
  if (role === "admin") return true;
  return Boolean(perms?.[key]);
}

