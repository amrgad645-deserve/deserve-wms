export interface Product {
  sku: string;
  model: string;
  color: string;
  size: string;
  barcode: string;
  good_stock: number;
  defective_stock: number;
  bin_location?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Movement {
  id: number;
  mov_id: string;
  date: string;
  time: string;
  ref_order: string;
  sku: string;
  model: string;
  color: string;
  size: string;
  qty: number;
  type: "DISPATCH" | "RECEIVE" | "RETURN_GOOD" | "RETURN_DEFECTIVE" | "PICKING_DEFECT" | "PHYSICAL_AUDIT" | "ADJUSTMENT" | "BUNDLE_ASSEMBLE" | "BUNDLE_DISASSEMBLE" | "REPAIR_IN" | "REPAIR_OUT" | "FACTORY_SEND" | "FACTORY_RETURN";
  operator: string;
  notes: string;
  created_at: string;
}

export interface KPIStats {
  totalSellable: number;
  totalDefective: number;
  totalPhysical: number;
  totalSkus: number;
  lowStockSkus: number;
  outOfStockSkus: number;
  todayDispatchedUnits: number;
  todayDispatchedOrders: number;
  todayReceivedUnits: number;
  todayReturnedGoodUnits: number;
  todayDefectiveUnits: number;
}

export interface RepairItem {
  id: number;
  repair_id: string;
  sku: string;
  model: string;
  color: string;
  size: string;
  qty: number;
  defect_reason: string;
  spare_parts?: string;
  status: "IN_PROGRESS" | "AT_FACTORY" | "COMPLETED" | "SCRAPPED" | "CREDITED" | "REJECTED";
  repair_type: "INTERNAL" | "FACTORY";
  factory_name?: string;
  factory_ref?: string;
  sent_to_factory_at?: string;
  outcome?: "REPAIRED" | "REPLACED" | "CREDIT" | "REJECTED";
  operator: string;
  started_at: string;
  completed_at?: string;
  notes?: string;
  created_at: string;
}

export interface ShipmentManifest {
  id: number;
  manifest_id: string;
  courier: string;
  driver_name?: string;
  driver_phone?: string;
  car_number?: string;
  orders_json: string;
  total_orders: number;
  operator: string;
  created_at: string;
}

export interface BundleDefinition {
  setSku: string;
  setName: string;
  model: string;
  color: string;
  items: {
    sku: string;
    size: string;
    qty: number;
  }[];
}

export interface Employee {
  id: number;
  name: string;
  role: string;
  active: number;
  created_at?: string;
}