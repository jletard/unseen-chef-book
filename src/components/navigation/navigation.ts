// src/components/navigation/navigation.ts
// Navigation structure for the cookbook workflows.

export type NavigationItem = {
  label: string;
  href: string;
};

export type NavigationSection = NavigationItem & {
  matchPath: string;
  children: NavigationItem[];
};

export const navigationSections: NavigationSection[] = [
  {
    label: "Planning",
    href: "/planning/menu-items",
    matchPath: "/planning",
    children: [
      {
        label: "Menu Items",
        href: "/planning/menu-items",
      },
      {
        label: "Main Dishes",
        href: "/planning/main-dishes",
      },
      {
        label: "Components",
        href: "/planning/components",
      },
      {
        label: "Sides",
        href: "/planning/sides",
      },
      {
        label: "Ingredients",
        href: "/planning/ingredients",
      },
      {
        label: "Categories",
        href: "/planning/categories",
      },
      {
        label: "Protein Types",
        href: "/planning/protein-types",
      },
    ],
  },
  {
    label: "Production",
    href: "/production/shopping",
    matchPath: "/production",
    children: [
      {
        label: "Production List",
        href: "/production/list",
      },
      {
        label: "Shopping List",
        href: "/production/shopping",
      },
      {
        label: "Prep List",
        href: "/production/prep",
      },
    ],
  },
  {
    label: "Cook",
    href: "/cook/this-week",
    matchPath: "/cook",
    children: [
      {
        label: "This Week",
        href: "/cook/this-week",
      },
      {
        label: "Recipe Search",
        href: "/cook/search",
      },
    ],
  },
];