export interface MorphologySegment {
  wordLocation: string;
  segmentIndex: number;
  segmentText: string;
  partOfSpeech: string;
  rootArabic: string | null;
  lemmaArabic: string | null;
  features: string[];
}

export interface WordMorphology {
  rootArabic: string | null;
  lemmaArabic: string | null;
  segments: MorphologySegment[];
}

export interface CanonicalWord {
  id: number;
  position: number;
  location: string;
  pageNumber: number;
  lineNumber: number;
  textUthmani: string;
  textImlaei: string;
  translationTr: string;
  transliteration: string | null;
  audioUrl: string | null;
  morphology: WordMorphology;
}

export interface VerseTranslation {
  resourceId: number;
  translatorName: string;
  languageCode: string;
  text: string;
}

export interface VerseAudio {
  alafasyAyahUrl: string | null;
  husaryMuallimAyahUrl: string | null;
  alafasyChapterSegment: {
    timestampFromMs: number;
    timestampToMs: number;
    durationMs: number;
    segments: [number, number, number][];
  } | null;
}

export interface CanonicalVerse {
  id: number;
  surahId: number;
  verseNumber: number;
  verseKey: string;
  pageNumber: number;
  juzNumber: number;
  hizbNumber: number;
  rubElHizbNumber: number;
  textUthmani: string;
  textUthmaniTanzil: string;
  textUthmaniSha256: string;
  tanzilTextSha256: string;
  textImlaei: string;
  translations: VerseTranslation[];
  audio: VerseAudio;
  words: CanonicalWord[];
}

export interface CanonicalSurahMeta {
  id: number;
  nameArabic: string;
  nameSimple: string;
  nameTurkish: string;
  revelationPlace: string;
  revelationOrder: number;
  versesCount: number;
  pages: [number, number];
  bismillahPre: boolean;
}

export interface CanonicalEditionMeta {
  slug: string;
  name: string;
  scriptType: string;
  totalPages: number;
}

export interface CanonicalSurahDataset {
  edition: CanonicalEditionMeta;
  surah: CanonicalSurahMeta;
  chapterRecitations: {
    alafasyChapterAudioUrl: string | null;
  };
  verses: CanonicalVerse[];
}

export interface CanonicalSurahEntry {
  surah: CanonicalSurahMeta;
  chapterRecitations: {
    alafasyChapterAudioUrl: string | null;
  };
  verses: CanonicalVerse[];
}

export interface CanonicalCollectionDataset {
  edition: CanonicalEditionMeta;
  includedPages: number[];
  surahs: CanonicalSurahEntry[];
}

export interface MushafPageData {
  edition: CanonicalEditionMeta;
  pageNumber: number;
  juzNumber: number;
  hizbNumber: number;
  availablePages: number[];
  sections: Array<{
    surah: CanonicalSurahMeta;
    chapterAudioUrl: string | null;
    startsOnThisPage: boolean;
    verses: CanonicalVerse[];
  }>;
}

export interface SourceManifestEntry {
  id: string;
  provider: string;
  resource: string;
  url: string;
  license: string;
  attribution: string;
  retrievedAt: string;
  version: string;
  usageRestrictions: string;
}

export interface ContentManifest {
  generatedAt: string;
  sources: SourceManifestEntry[];
  datasets: Record<
    string,
    {
      path: string;
      sha256: string;
      surahsCount?: number;
      pagesCount?: number;
      versesCount: number;
      wordsCount: number;
    }
  >;
}
