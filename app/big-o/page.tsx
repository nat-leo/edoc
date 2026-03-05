import { BigOPathCard, type BigOType } from "@/components/ui/big-o-path-card";

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <BigOPathCard type="O(1)" className="h-[260px]" />
        <BigOPathCard type="O(n)" className="h-[260px]" />
        <BigOPathCard type="O(n^2)" className="h-[260px]" />
      </div>
    </div>
  );
}