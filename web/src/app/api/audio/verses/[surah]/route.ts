// Same as RootedQuran's /api/audio/verses/[surah]: ayah audio URLs for a surah and reciter.
function normalizeAudioUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `https://verses.quran.foundation/${url.replace(/^\/+/, "")}`;
}

const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
  135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75,
  85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
  14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19,
  36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7,
  3, 6, 3, 5, 4, 5, 6,
];

function alfurqanAudioByVerseKey(reciterId: string, surah: number) {
  const verseCount = AYAH_COUNTS[surah - 1] ?? 0;
  const audioByVerseKey: Record<string, string> = {};

  for (let verse = 1; verse <= verseCount; verse += 1) {
    audioByVerseKey[`${surah}:${verse}`] =
      `https://alfurqan.online/api/v1/audio/${encodeURIComponent(reciterId)}/surah/${surah}/ayah/${verse}`;
  }

  return audioByVerseKey;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ surah: string }> },
) {
  const { surah } = await params;
  const surahNumber = Number(surah);
  const { searchParams } = new URL(request.url);
  const recitationKey = searchParams.get("recitation_key");
  const legacyRecitationId = searchParams.get("recitation_id");

  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    return Response.json({ error: "invalid surah" }, { status: 400 });
  }

  if (recitationKey?.startsWith("alfurqan:")) {
    const reciterId = recitationKey.slice("alfurqan:".length);
    if (!reciterId) {
      return Response.json({ error: "invalid recitation_key" }, { status: 400 });
    }

    return Response.json({
      audioByVerseKey: alfurqanAudioByVerseKey(reciterId, surahNumber),
      reciterName: null,
      source: "alfurqan",
    });
  }

  const recitationId = recitationKey?.startsWith("quran:")
    ? recitationKey.slice("quran:".length)
    : legacyRecitationId;

  if (!recitationId) {
    return Response.json({ error: "recitation_key is required" }, { status: 400 });
  }

  const upstream =
    `https://api.quran.com/api/v4/quran/recitations/${recitationId}` +
    `?chapter_number=${surahNumber}&fields=verse_key,url`;

  const res = await fetch(upstream, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) {
    return Response.json({ error: "upstream failed" }, { status: res.status });
  }

  const data = await res.json();
  const audioByVerseKey: Record<string, string> = {};

  for (const file of data.audio_files ?? []) {
    if (file.verse_key && file.url) {
      audioByVerseKey[file.verse_key] = normalizeAudioUrl(file.url);
    }
  }

  return Response.json({
    audioByVerseKey,
    reciterName: data.meta?.reciter_name ?? null,
    source: "quran",
  });
}
