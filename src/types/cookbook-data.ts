export type MenuItemRecord = {
  id: string;
  name: string;
  shortName: string | null;
  description: string;
  menuType: string;
  category: string | null;
  proteinType: string;
  sides: string[];
  isVegan: boolean;
  active: boolean;
};

export type ReferenceRecord = {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
};

export type SideRequirement = {
  name: string;
  quantity: number;
};

export type ProductionItem = {
  key: string;
  menuItemId: string | null;
  name: string;
  menuType: string;
  category: string;
  quantity: number;
  sideRequirements: SideRequirement[];
};

export type BulkProductionItem = {
  key: string;
  itemId: string;
  name: string;
  category: "Proteins" | "Sides";
  unitLabel: string;
  quantity: number;
};

export type ProductionSummary = {
  productionWeek: string;
  confirmedOrderCount: number;
  totalPortions: number;
  items: ProductionItem[];
  bulkItems: BulkProductionItem[];
};
