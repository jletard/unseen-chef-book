import ProductionList from "@/components/production/ProductionList";

export default function ProductionPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Production</h1>

      <p className="mt-2 text-sm text-zinc-400">
        Food-only totals from confirmed orders for the selected production
        week. Customer, payment, fulfillment, and packaging information remain
        in Admin.
      </p>

      <ProductionList />
    </>
  );
}
