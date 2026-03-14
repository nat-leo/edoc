import { Curriculum } from "@/components/curriculum";

export default function CurriculumPage() {
  return (
    <main className="px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <h1 className="text-2xl font-semibold">Curriculum</h1>
        <Curriculum />
      </div>
    </main>
  );
}
