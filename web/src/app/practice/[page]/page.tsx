import { notFound } from "next/navigation";
import MushafPractice from "@/components/MushafPractice";
import type { Kind, Mode } from "@/lib/progress";

const KINDS: Kind[] = ["sabaq", "sabqi", "manzil", "free"];

export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ kind?: string; mode?: string }>;
}) {
  const { page } = await params;
  const { kind, mode } = await searchParams;
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1 || n > 604) notFound();
  return (
    <MushafPractice
      page={n}
      kind={KINDS.includes(kind as Kind) ? (kind as Kind) : "free"}
      mode={(mode === "meaning" ? "meaning" : "recite") as Mode}
    />
  );
}
