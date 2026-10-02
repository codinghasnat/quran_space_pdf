import { redirect } from "next/navigation";

// Older links: practice now happens in the mushaf reader
export default async function PracticePage({ params }: { params: Promise<{ page: string }> }) {
  const { page } = await params;
  redirect(`/mushaf?page=${Number(page) || 1}`);
}
