export type NavigationItem = {
  label: string;
  href: string;
};

export type NavigationSection = NavigationItem & {
  matchPaths: string[];
  children: NavigationItem[];
};

export function sectionMatchesPath(section: NavigationSection, pathname: string) {
  return section.matchPaths.some((path) => pathname.startsWith(path));
}

export const navigationSections: NavigationSection[] = [
  {
    label: "Production",
    href: "/production",
    matchPaths: ["/production"],
    children: [
      { label: "Today / This Week", href: "/production" },
      { label: "Production Totals", href: "/production/list" },
      { label: "Prep List", href: "/production/prep" },
      { label: "Recipes", href: "/production/recipes" },
      { label: "Shopping", href: "/production/shopping" },
      { label: "Labels", href: "/production/labels" },
    ],
  },
  {
    label: "Cookbook",
    href: "/cookbook",
    matchPaths: ["/cookbook"],
    children: [
      { label: "The Cookbook", href: "/cookbook" },
    ],
  },
  {
    label: "Maintenance",
    href: "/dashboard",
    matchPaths: ["/dashboard", "/planning"],
    children: [
      { label: "Maintenance Home", href: "/dashboard" },
      { label: "Reconciliation", href: "/planning/reconciliation" },
      { label: "Ingredients", href: "/planning/ingredients" },
      { label: "Nutrition", href: "/planning/nutrition" },
      { label: "Menu Items", href: "/planning/menu-items" },
      { label: "Main Dishes", href: "/planning/main-dishes" },
      { label: "Components", href: "/planning/components" },
      { label: "Sides", href: "/planning/sides" },
      { label: "Data Repair", href: "/planning/data-repair" },
    ],
  },
];
