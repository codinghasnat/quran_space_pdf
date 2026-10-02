import { notFound } from "next/navigation";
import FreePractice from "@/components/hifz/FreePractice";

export default async function PracticePage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  const n = Number(page);
  if (!Number.isInteger(n) || n < 1 || n > 604) notFound();
  return <FreePractice page={n} />;
}
