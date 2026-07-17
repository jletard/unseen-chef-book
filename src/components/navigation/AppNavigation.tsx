// src/components/navigation/AppNavigation.tsx
// Complete application navigation.

import PrimaryTabs from "./PrimaryTabs";
import SecondaryTabs from "./SecondaryTabs";

export default function AppNavigation() {
  return (
    <>
      <PrimaryTabs />
      <SecondaryTabs />
    </>
  );
}