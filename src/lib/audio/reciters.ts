import type { CanonicalVerse } from "@/lib/content/types";

export interface ReciterInfo {
  id: number;
  nameTr: string;
  styleTr: string;
  sourceLabel: string;
}

export const QURAN_RECITERS: readonly ReciterInfo[] = [
  {
    id: 7,
    nameTr: "Mişari Râşid el-Afâsî",
    styleTr: "Murattal",
    sourceLabel: "Quran.com / Alafasy",
  },
  {
    id: 12,
    nameTr: "Mahmud Halîl el-Husarî (Muallim)",
    styleTr: "Muallim / Eğitim",
    sourceLabel: "EveryAyah / Husary Muallim",
  },
  {
    id: 6,
    nameTr: "Mahmud Halîl el-Husarî (Mürettel)",
    styleTr: "Murattal",
    sourceLabel: "Quran.com / Husary",
  },
  {
    id: 1,
    nameTr: "Abdülbasit Abdüssamed (Mürettel)",
    styleTr: "Murattal",
    sourceLabel: "Quran.com / AbdulBaset",
  },
  {
    id: 3,
    nameTr: "Abdurrahman es-Sudeys",
    styleTr: "Murattal",
    sourceLabel: "Quran.com / Sudais",
  },
  {
    id: 4,
    nameTr: "Ebû Bekir eş-Şatrî",
    styleTr: "Murattal",
    sourceLabel: "Quran.com / Shatri",
  },
] as const;

const RECITER_BASE_PATH_MAP: Record<number, string> = {
  7: "https://verses.quran.foundation/Alafasy/mp3",
  12: "https://mirrors.quranicaudio.com/everyayah/Husary_Muallim_128kbps",
  6: "https://verses.quran.foundation/Husary/mp3",
  1: "https://verses.quran.foundation/AbdulBaset/Murattal/mp3",
  3: "https://verses.quran.foundation/Sudais/mp3",
  4: "https://verses.quran.foundation/Shatri/mp3",
};

export function getReciterById(reciterId: number): ReciterInfo {
  return QURAN_RECITERS.find((r) => r.id === reciterId) ?? QURAN_RECITERS[0]!;
}

export function getReciterAyahAudioUrl(
  verse: Pick<CanonicalVerse, "surahId" | "verseNumber" | "audio">,
  reciterId: number
): string | null {
  if (!Number.isInteger(verse.surahId) || !Number.isInteger(verse.verseNumber)) {
    return null;
  }

  const surahPad = String(verse.surahId).padStart(3, "0");
  const ayahPad = String(verse.verseNumber).padStart(3, "0");
  const fileSuffix = `${surahPad}${ayahPad}.mp3`;

  if (reciterId === 7) {
    return (
      verse.audio.alafasyAyahUrl ??
      `${RECITER_BASE_PATH_MAP[7]}/${fileSuffix}`
    );
  }

  if (reciterId === 12) {
    return (
      verse.audio.husaryMuallimAyahUrl ??
      `${RECITER_BASE_PATH_MAP[12]}/${fileSuffix}`
    );
  }

  const baseUrl = RECITER_BASE_PATH_MAP[reciterId];
  if (baseUrl) {
    return `${baseUrl}/${fileSuffix}`;
  }

  return (
    verse.audio.alafasyAyahUrl ??
    `${RECITER_BASE_PATH_MAP[7]}/${fileSuffix}`
  );
}
