// Same as RootedQuran's /api/audio/recitations.
import { defaultRecitationKey, filterSupportedRecitations } from "@/lib/hifz/reciters";

export async function GET() {
  const upstream = "https://api.quran.com/api/v4/resources/recitations?language=en";
  let rawRecitations: Parameters<typeof filterSupportedRecitations>[0] = [];

  try {
    const res = await fetch(upstream, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });

    if (res.ok) {
      const data = await res.json();
      rawRecitations = data.recitations ?? [];
    }
  } catch {
    rawRecitations = [];
  }

  const recitations = filterSupportedRecitations(rawRecitations);

  return Response.json({
    recitations,
    defaultRecitationKey: defaultRecitationKey(recitations),
  });
}
