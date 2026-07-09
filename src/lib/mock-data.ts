/**
 * Mock data for the UI. No database — every page reads from here so the
 * design can be evaluated with realistic, human-feeling content.
 */
import type { DictKey } from "@/lib/i18n/dictionaries";

export type Trend = "up" | "down";

export interface Stat {
  key: string;
  labelKey: DictKey;
  value: string;
  delta: string;
  trend: Trend;
  spark: number[];
}

export const dashboardStats: Stat[] = [
  { key: "revenue", labelKey: "dash.revenue", value: "$48,210", delta: "+12.4%", trend: "up", spark: [12, 18, 14, 22, 26, 24, 31, 29, 36] },
  { key: "orders", labelKey: "dash.orders", value: "1,284", delta: "+8.1%", trend: "up", spark: [30, 28, 33, 31, 35, 38, 36, 41, 44] },
  { key: "clients", labelKey: "dash.clients", value: "642", delta: "+3.6%", trend: "up", spark: [20, 21, 20, 23, 22, 25, 27, 26, 28] },
  { key: "fulfilment", labelKey: "dash.fulfilment", value: "96.2%", delta: "-0.8%", trend: "down", spark: [40, 39, 41, 38, 37, 39, 38, 36, 37] },
];

export const analyticsStats: Stat[] = [
  { key: "visitors", labelKey: "analytics.visitors", value: "82,401", delta: "+18.2%", trend: "up", spark: [10, 14, 13, 19, 24, 22, 30, 34, 40] },
  { key: "conversion", labelKey: "analytics.conversion", value: "4.7%", delta: "+0.6%", trend: "up", spark: [20, 22, 21, 24, 23, 26, 28, 27, 30] },
  { key: "avgOrder", labelKey: "analytics.avgOrder", value: "$137.50", delta: "+5.0%", trend: "up", spark: [25, 24, 27, 26, 29, 31, 30, 33, 35] },
  { key: "retention", labelKey: "analytics.retention", value: "71.3%", delta: "-1.2%", trend: "down", spark: [38, 37, 39, 36, 35, 34, 35, 33, 32] },
];

/** 12-month revenue series (two lines: this year vs last year) */
export const revenueSeries = {
  labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  current: [18, 22, 19, 27, 31, 29, 38, 42, 39, 47, 52, 58],
  previous: [14, 16, 18, 20, 22, 24, 26, 29, 31, 33, 36, 40],
};

export const channelBreakdown = [
  { label: "Direct", value: 42, color: "var(--accent)" },
  { label: "Marketplace", value: 28, color: "#38bdf8" },
  { label: "Wholesale", value: 18, color: "#7dd3fc" },
  { label: "Referral", value: 12, color: "#0369a1" },
];

export const trafficSources = [
  { label: "Organic search", value: 38, count: "31.3k" },
  { label: "Social", value: 24, count: "19.8k" },
  { label: "Email", value: 19, count: "15.7k" },
  { label: "Paid ads", value: 12, count: "9.9k" },
  { label: "Direct", value: 7, count: "5.8k" },
];

export const weeklyCohorts = [
  [92, 71, 58, 49, 44, 41],
  [88, 66, 54, 47, 42, 0],
  [90, 70, 60, 52, 0, 0],
  [85, 64, 51, 0, 0, 0],
  [91, 72, 0, 0, 0, 0],
  [87, 0, 0, 0, 0, 0],
];

export type OrderStatus = "paid" | "pending" | "shipped" | "refunded";
export interface Order {
  id: string;
  customer: string;
  email: string;
  date: string;
  total: string;
  status: OrderStatus;
  items: number;
}

export const orders: Order[] = [
  { id: "#ORB-2041", customer: "Amelia Hart", email: "amelia@northwind.co", date: "Jun 28", total: "$248.00", status: "paid", items: 3 },
  { id: "#ORB-2040", customer: "Youssef Karim", email: "y.karim@meridian.io", date: "Jun 28", total: "$1,120.00", status: "shipped", items: 8 },
  { id: "#ORB-2039", customer: "Lena Fischer", email: "lena.f@atlas.de", date: "Jun 27", total: "$76.50", status: "pending", items: 1 },
  { id: "#ORB-2038", customer: "Diego Morales", email: "diego@solara.mx", date: "Jun 27", total: "$534.20", status: "paid", items: 5 },
  { id: "#ORB-2037", customer: "Priya Nair", email: "priya@kavi.in", date: "Jun 26", total: "$310.00", status: "refunded", items: 2 },
  { id: "#ORB-2036", customer: "Tomas Novak", email: "tomas@brnoworks.cz", date: "Jun 26", total: "$892.75", status: "shipped", items: 6 },
  { id: "#ORB-2035", customer: "Sara Lindqvist", email: "sara@fjord.se", date: "Jun 25", total: "$148.90", status: "paid", items: 2 },
  { id: "#ORB-2034", customer: "Marcus Bell", email: "marcus@oakline.us", date: "Jun 25", total: "$2,040.00", status: "pending", items: 12 },
  { id: "#ORB-2033", customer: "Hana Sato", email: "hana@tsuki.jp", date: "Jun 24", total: "$67.00", status: "paid", items: 1 },
  { id: "#ORB-2032", customer: "Owen Pryce", email: "owen@valley.uk", date: "Jun 24", total: "$418.30", status: "shipped", items: 4 },
];

export interface Client {
  name: string;
  company: string;
  spend: string;
  since: string;
  initials: string;
  hue: number;
  orders: number;
}

export const clients: Client[] = [
  { name: "Amelia Hart", company: "Northwind Co.", spend: "$14,280", since: "2022", initials: "AH", hue: 12, orders: 38 },
  { name: "Youssef Karim", company: "Meridian", spend: "$31,540", since: "2021", initials: "YK", hue: 210, orders: 64 },
  { name: "Lena Fischer", company: "Atlas GmbH", spend: "$8,910", since: "2023", initials: "LF", hue: 280, orders: 19 },
  { name: "Diego Morales", company: "Solara", spend: "$22,070", since: "2020", initials: "DM", hue: 150, orders: 51 },
  { name: "Priya Nair", company: "Kavi Studio", spend: "$6,430", since: "2024", initials: "PN", hue: 330, orders: 12 },
  { name: "Tomas Novak", company: "Brno Works", spend: "$18,650", since: "2022", initials: "TN", hue: 40, orders: 44 },
  { name: "Sara Lindqvist", company: "Fjord", spend: "$11,200", since: "2023", initials: "SL", hue: 190, orders: 27 },
  { name: "Marcus Bell", company: "Oakline", spend: "$40,120", since: "2019", initials: "MB", hue: 95, orders: 88 },
];

export type StockState = "inStock" | "low" | "out";
export interface Product {
  name: string;
  sku: string;
  category: string;
  price: string;
  stock: number;
  state: StockState;
  hue: number;
}

export const products: Product[] = [
  { name: "Aurora Desk Lamp", sku: "LMP-014", category: "Lighting", price: "$89", stock: 142, state: "inStock", hue: 255 },
  { name: "Drift Lounge Chair", sku: "CHR-220", category: "Seating", price: "$420", stock: 12, state: "low", hue: 28 },
  { name: "Meridian Wall Clock", sku: "CLK-007", category: "Decor", price: "$64", stock: 0, state: "out", hue: 200 },
  { name: "Fjord Wool Throw", sku: "TXT-051", category: "Textiles", price: "$78", stock: 233, state: "inStock", hue: 160 },
  { name: "Solara Planter", sku: "PLT-033", category: "Garden", price: "$36", stock: 7, state: "low", hue: 130 },
  { name: "Atlas Bookend Set", sku: "BKE-019", category: "Decor", price: "$52", stock: 96, state: "inStock", hue: 300 },
  { name: "Kavi Ceramic Vase", sku: "VAS-088", category: "Decor", price: "$45", stock: 58, state: "inStock", hue: 340 },
  { name: "Oakline Side Table", sku: "TBL-110", category: "Furniture", price: "$190", stock: 0, state: "out", hue: 45 },
];

export type Presence = "online" | "away" | "offline";
export interface Member {
  name: string;
  role: string;
  initials: string;
  hue: number;
  presence: Presence;
  email: string;
}

export const team: Member[] = [
  { name: "Nadia Rahmani", role: "Operations Lead", initials: "NR", hue: 265, presence: "online", email: "nadia@orbit.app" },
  { name: "James Okoro", role: "Fulfilment Manager", initials: "JO", hue: 200, presence: "online", email: "james@orbit.app" },
  { name: "Clara Beaumont", role: "Customer Success", initials: "CB", hue: 330, presence: "away", email: "clara@orbit.app" },
  { name: "Ravi Menon", role: "Inventory Analyst", initials: "RM", hue: 150, presence: "offline", email: "ravi@orbit.app" },
  { name: "Sofia Greco", role: "Finance", initials: "SG", hue: 25, presence: "online", email: "sofia@orbit.app" },
  { name: "Liam Walsh", role: "Logistics", initials: "LW", hue: 95, presence: "away", email: "liam@orbit.app" },
];

export interface Task {
  id: string;
  title: string;
  tag: string;
  assignee: string;
  hue: number;
  due: string;
}
export interface TaskColumn {
  key: string;
  titleKey: DictKey;
  tasks: Task[];
}

export const taskBoard: TaskColumn[] = [
  {
    key: "backlog",
    titleKey: "tasks.backlog",
    tasks: [
      { id: "T-91", title: "Audit Q2 supplier contracts", tag: "Ops", assignee: "NR", hue: 265, due: "Jul 2" },
      { id: "T-90", title: "Draft returns policy v3", tag: "Policy", assignee: "CB", hue: 330, due: "Jul 5" },
      { id: "T-88", title: "Source eco packaging", tag: "Sourcing", assignee: "RM", hue: 150, due: "Jul 9" },
    ],
  },
  {
    key: "inProgress",
    titleKey: "tasks.inProgress",
    tasks: [
      { id: "T-87", title: "Migrate warehouse labels", tag: "Logistics", assignee: "LW", hue: 95, due: "Jun 30" },
      { id: "T-85", title: "Reconcile June invoices", tag: "Finance", assignee: "SG", hue: 25, due: "Jun 29" },
    ],
  },
  {
    key: "review",
    titleKey: "tasks.review",
    tasks: [
      { id: "T-83", title: "Restock thresholds proposal", tag: "Inventory", assignee: "RM", hue: 150, due: "Jun 28" },
      { id: "T-82", title: "Courier SLA comparison", tag: "Logistics", assignee: "JO", hue: 200, due: "Jun 28" },
    ],
  },
  {
    key: "done",
    titleKey: "tasks.done",
    tasks: [
      { id: "T-80", title: "Onboard 3 new clients", tag: "Success", assignee: "CB", hue: 330, due: "Jun 24" },
      { id: "T-79", title: "Close May books", tag: "Finance", assignee: "SG", hue: 25, due: "Jun 22" },
    ],
  },
];

export interface Activity {
  who: string;
  initials: string;
  hue: number;
  action: string;
  target: string;
  time: string;
}

export const recentActivity: Activity[] = [
  { who: "James Okoro", initials: "JO", hue: 200, action: "shipped order", target: "#ORB-2040", time: "4m" },
  { who: "Sofia Greco", initials: "SG", hue: 25, action: "approved refund", target: "#ORB-2037", time: "26m" },
  { who: "Nadia Rahmani", initials: "NR", hue: 265, action: "added supplier", target: "Brno Works", time: "1h" },
  { who: "Clara Beaumont", initials: "CB", hue: 330, action: "replied to", target: "Amelia Hart", time: "2h" },
  { who: "Ravi Menon", initials: "RM", hue: 150, action: "restocked", target: "Fjord Wool Throw", time: "3h" },
];

export interface ReportItem {
  name: string;
  type: string;
  updated: string;
  schedule: string;
  icon: "bar" | "doc" | "pie" | "trend";
}

export const reports: ReportItem[] = [
  { name: "Monthly revenue summary", type: "Finance", updated: "Jun 27", schedule: "Monthly", icon: "trend" },
  { name: "Inventory turnover", type: "Operations", updated: "Jun 25", schedule: "Weekly", icon: "bar" },
  { name: "Client cohort retention", type: "Growth", updated: "Jun 24", schedule: "Quarterly", icon: "pie" },
  { name: "Fulfilment SLA report", type: "Logistics", updated: "Jun 22", schedule: "Weekly", icon: "doc" },
  { name: "Refund & returns log", type: "Finance", updated: "Jun 20", schedule: "Monthly", icon: "doc" },
];
