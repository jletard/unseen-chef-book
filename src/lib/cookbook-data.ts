import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  BulkProductionItem,
  MenuItemRecord,
  ProductionItem,
  ProductionSummary,
  ReferenceRecord,
} from "@/types/cookbook-data";

type MenuItemRow = {
  id: string;
  name: string;
  short_name: string | null;
  description: string;
  menu_type: string;
  category: string | null;
  protein_type: string;
  sides: string[] | null;
  is_vegan: boolean;
  active: boolean | null;
};

type OrderRow = {
  id: string;
  total_portions: number | null;
};

type OrderItemRow = {
  id: string;
  menu_item_id: string | null;
  item_name: string;
  item_sides: string[] | null;
  quantity: number;
};

type MenuMetadataRow = {
  id: string;
  short_name: string | null;
  menu_type: string;
  category: string | null;
};

type BulkOrderData = {
  items?: {
    proteins?: Array<{
      id: string;
      name: string;
      quantity: number;
      unitLabel: string;
    }>;
    sides?: Array<{
      id: string;
      name: string;
      unitLabel: string;
    }>;
  };
};

type BulkOrderRow = {
  bulk_order: BulkOrderData | null;
};

type ReferenceTable = "categories" | "protein_types" | "side_items";

function menuItemFromRow(row: MenuItemRow): MenuItemRecord {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    description: row.description,
    menuType: row.menu_type,
    category: row.category,
    proteinType: row.protein_type,
    sides: row.sides ?? [],
    isVegan: row.is_vegan,
    active: row.active !== false,
  };
}

export async function getMenuItems(): Promise<MenuItemRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("menu_items_v2")
    .select(
      "id, name, short_name, description, menu_type, category, protein_type, sides, is_vegan, active",
    )
    .order("active", { ascending: false })
    .order("menu_type", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Failed to load menu items: " + error.message);
  }

  return ((data ?? []) as MenuItemRow[]).map(menuItemFromRow);
}

export async function getReferenceRecords(
  table: ReferenceTable,
): Promise<ReferenceRecord[]> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, name, active, sort_order")
    .order("active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error("Failed to load " + table + ": " + error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    active: boolean;
    sort_order: number;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    sortOrder: row.sort_order,
  }));
}

export async function getProductionSummary(
  productionWeek: string,
): Promise<ProductionSummary> {
  const { data: ordersData, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id, total_portions")
    .eq("status", "confirmed")
    .eq("production_week", productionWeek);

  if (ordersError) {
    throw new Error("Failed to load confirmed orders: " + ordersError.message);
  }

  const orders = (ordersData ?? []) as OrderRow[];
  const orderIds = orders.map((order) => order.id);

  if (orderIds.length === 0) {
    return {
      productionWeek,
      confirmedOrderCount: 0,
      totalPortions: 0,
      items: [],
      bulkItems: [],
    };
  }

  const [
    { data: itemData, error: itemError },
    { data: bulkData, error: bulkError },
  ] = await Promise.all([
    supabaseAdmin
      .from("order_items")
      .select("id, menu_item_id, item_name, item_sides, quantity")
      .in("order_id", orderIds),
    supabaseAdmin
      .from("bulk_orders")
      .select("bulk_order")
      .in("order_id", orderIds),
  ]);

  if (itemError) {
    throw new Error("Failed to load order items: " + itemError.message);
  }

  if (bulkError) {
    throw new Error("Failed to load bulk orders: " + bulkError.message);
  }

  const orderItems = (itemData ?? []) as OrderItemRow[];
  const menuItemIds = Array.from(
    new Set(
      orderItems
        .map((item) => item.menu_item_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const metadata = new Map<string, MenuMetadataRow>();

  if (menuItemIds.length > 0) {
    const { data: metadataData, error: metadataError } = await supabaseAdmin
      .from("menu_items_v2")
      .select("id, short_name, menu_type, category")
      .in("id", menuItemIds);

    if (metadataError) {
      throw new Error("Failed to load menu metadata: " + metadataError.message);
    }

    for (const row of (metadataData ?? []) as MenuMetadataRow[]) {
      metadata.set(row.id, row);
    }
  }

  const itemMap = new Map<
    string,
    ProductionItem & { sideMap: Map<string, number> }
  >();

  for (const row of orderItems) {
    const key = row.menu_item_id ?? "ordered:" + row.item_name;
    const details = row.menu_item_id
      ? metadata.get(row.menu_item_id)
      : undefined;
    const quantity = Number(row.quantity ?? 0);
    const existing = itemMap.get(key);

    if (existing) {
      existing.quantity += quantity;

      for (const side of row.item_sides ?? []) {
        existing.sideMap.set(
          side,
          (existing.sideMap.get(side) ?? 0) + quantity,
        );
      }

      continue;
    }

    const sideMap = new Map<string, number>();

    for (const side of row.item_sides ?? []) {
      sideMap.set(side, (sideMap.get(side) ?? 0) + quantity);
    }

    itemMap.set(key, {
      key,
      menuItemId: row.menu_item_id,
      name: details?.short_name?.trim() || row.item_name,
      menuType: details?.menu_type ?? "entree",
      category:
        details?.menu_type === "dessert"
          ? "Dessert"
          : details?.category?.trim() || "Entrees",
      quantity,
      sideRequirements: [],
      sideMap,
    });
  }

  const items = Array.from(itemMap.values())
    .map(({ sideMap, ...item }) => ({
      ...item,
      sideRequirements: Array.from(sideMap.entries())
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => {
      if (left.category !== right.category) {
        return left.category.localeCompare(right.category);
      }

      if (right.quantity !== left.quantity) {
        return right.quantity - left.quantity;
      }

      return left.name.localeCompare(right.name);
    });

  const bulkMap = new Map<string, BulkProductionItem>();

  function addBulkItem(item: BulkProductionItem) {
    const existing = bulkMap.get(item.key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      bulkMap.set(item.key, item);
    }
  }

  for (const row of (bulkData ?? []) as BulkOrderRow[]) {
    for (const protein of row.bulk_order?.items?.proteins ?? []) {
      const quantity = Number(protein.quantity ?? 0);

      if (quantity > 0) {
        addBulkItem({
          key: "protein:" + protein.id + ":" + protein.unitLabel,
          itemId: protein.id,
          name: protein.name,
          category: "Proteins",
          unitLabel: protein.unitLabel,
          quantity,
        });
      }
    }

    for (const side of row.bulk_order?.items?.sides ?? []) {
      addBulkItem({
        key: "side:" + side.id + ":" + side.unitLabel,
        itemId: side.id,
        name: side.name,
        category: "Sides",
        unitLabel: side.unitLabel,
        quantity: 1,
      });
    }
  }

  const bulkItems = Array.from(bulkMap.values()).sort((left, right) => {
    if (left.category !== right.category) {
      return left.category === "Proteins" ? -1 : 1;
    }

    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return left.name.localeCompare(right.name);
  });

  return {
    productionWeek,
    confirmedOrderCount: orders.length,
    totalPortions: orders.reduce(
      (sum, order) => sum + Number(order.total_portions ?? 0),
      0,
    ),
    items,
    bulkItems,
  };
}
