"use client";

import React from "react";
import Link from "next/link";
import { Check, Plus, Volume2 } from "lucide-react";
import type { CanonicalVerse, CanonicalWord } from "@/lib/content/types";
import { getTajweedLegend, type TajweedRuleDetail } from "@/lib/content/tajweed-analyzer";
import { POS_LABELS_TR, isEnglishFallbackGloss, type RootOccurrencePreview } from "./shared";

interface WordInspectorProps {
  selectedWord: CanonicalWord | null;
  selectedVerse: CanonicalVerse;
  showTransliteration: boolean;
  rootOccurrences: RootOccurrencePreview[];
  /** Tajweed rules of the selected word (resolved with the whole verse). */
  tajweedRules: TajweedRuleDetail[];
  cardMessage: string | null;
  onPlayWord: (url: string, verseKey: string) => void;
  onAddWordCard: (direction: "ar_to_tr" | "tr_to_ar") => void;
}

/** Word meaning, verse meaning, morphology/root, tajweed rules and FSRS card buttons for the tapped word. */
export function WordInspector({
  selectedWord,
  selectedVerse,
  showTransliteration,
  rootOccurrences,
  tajweedRules,
  cardMessage,
  onPlayWord,
  onAddWordCard,
}: WordInspectorProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Kelime İnceleyici</h2>
          <p className="text-xs text-muted">Kelime anlamı ile ayet meali ayrı tutulur</p>
        </div>
        {selectedWord && (
          <span className="font-mono text-xs font-semibold rounded-lg bg-sand px-2.5 py-1 text-forest">
            {selectedWord.location}
          </span>
        )}
      </div>

      {selectedWord ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-line bg-parchment p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Kelime Anlamı (Sözlük / Bağlam)
              </p>
              <p className="mt-1 text-lg font-bold text-forest">{selectedWord.translationTr}</p>
              {isEnglishFallbackGloss(selectedWord.translationTr) && (
                <p className="mt-0.5 text-[11px] text-gold-ink">
                  Kaynak sözlük bu kelimede İngilizce karşılık döndürdü; anlam için aşağıdaki ayet mealine bakın.
                </p>
              )}
              {showTransliteration && selectedWord.transliteration && (
                <p className="mt-0.5 text-xs font-mono text-muted">
                  Okunuş yardımı: {selectedWord.transliteration}
                </p>
              )}
            </div>
            <div className="text-right">
              <p lang="ar" dir="rtl" translate="no" className="font-arabic text-4xl leading-[1.6] text-ink">
                {selectedWord.textUthmani}
              </p>
              {selectedWord.audioUrl && (
                <button
                  type="button"
                  onClick={() => onPlayWord(selectedWord.audioUrl!, selectedVerse.verseKey)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-deep"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Kelimeyi Dinle</span>
                </button>
              )}
            </div>
          </div>

          {/* Contextual Verse Meaning Kept Distinct */}
          <div className="rounded-xl border border-[#ece4cf] bg-surface p-3.5 text-xs space-y-1">
            <p className="font-semibold text-gold">
              Bulunduğu Ayet Meali ({selectedVerse.verseKey}):
            </p>
            <p className="text-ink-soft leading-relaxed">{selectedVerse.translations[0]?.text}</p>
          </div>

          {/* Morphology & Verified Root */}
          <div className="rounded-xl border border-[#ece4cf] bg-parchment p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Morfoloji ve Kök Bilgisi</span>
              <span className="text-[11px] text-muted">Quranic Arabic Corpus</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-surface border border-line p-2.5">
                <span className="text-[11px] text-muted block">Kök (Cizr)</span>
                <span
                  lang="ar"
                  dir="rtl"
                  translate="no"
                  className="font-arabic text-xl font-bold text-forest"
                >
                  {selectedWord.morphology.rootArabic ?? "— (Zamir/Edat)"}
                </span>
              </div>
              <div className="rounded-lg bg-surface border border-line p-2.5">
                <span className="text-[11px] text-muted block">Kelime Türü</span>
                <span className="text-xs font-semibold text-ink">
                  {selectedWord.morphology.segments
                    .map((s) => POS_LABELS_TR[s.partOfSpeech] ?? s.partOfSpeech)
                    .join(" + ") || "Doğrulanıyor"}
                </span>
              </div>
            </div>
            {rootOccurrences.length > 1 && (
              <div className="pt-1">
                <p className="text-[11px] font-medium text-muted mb-1">
                  Aynı kökten Kur&apos;an genelindeki örnek geçişler ({rootOccurrences.length}+):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {rootOccurrences.map((occ) => (
                    <Link
                      key={occ.location}
                      href={`/mushaf?page=${occ.pageNumber}&verse=${occ.verseKey}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface border border-line px-2 py-1 hover:border-forest"
                    >
                      <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                        {occ.textUthmani}
                      </span>
                      <span className="text-[11px] text-muted">({occ.location})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          <WordTajweedRules rules={tajweedRules} />

          {/* Add to FSRS Review Deck */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onAddWordCard("ar_to_tr")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-forest bg-forest/5 px-3 py-2 text-xs font-semibold text-forest hover:bg-forest/10"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>AR → TR Kartı</span>
            </button>
            <button
              type="button"
              onClick={() => onAddWordCard("tr_to_ar")}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gold bg-gold-soft px-3 py-2 text-xs font-semibold text-gold-deep hover:bg-[#efe4ca]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>TR → AR Kartı</span>
            </button>
          </div>
          {cardMessage && (
            <p className="text-xs font-medium text-emerald flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              {cardMessage}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted">
          İncelemek için soldaki Mushaf metninden herhangi bir kelimeye dokunun.
        </p>
      )}
    </div>
  );
}

/** Phase 7A: exact tajweed rules of the selected word; uncolored rules (İzhâr) are marked as such. */
function WordTajweedRules({ rules }: { rules: TajweedRuleDetail[] }) {
  return (
    <div className="rounded-xl border border-[#ece4cf] bg-parchment p-3.5 space-y-2 text-xs">
      <span className="font-semibold text-ink block">Kelimedeki Tecvid Kuralları</span>
      {rules.length > 0 ? (
        <div className="space-y-1.5">
          {rules.map((rule) => {
            const legend = getTajweedLegend(rule.category);
            const colorHex = rule.highlighted ? legend.colorHex : "#4b5563";
            return (
              <div
                key={rule.id}
                className="rounded-lg border p-2 space-y-0.5"
                style={{
                  borderColor: `${colorHex}40`,
                  backgroundColor: rule.highlighted ? legend.bgHex : "#ffffff",
                }}
              >
                <p className="font-bold" style={{ color: colorHex }}>
                  {rule.titleTr}
                  {!rule.highlighted && (
                    <span className="ml-1.5 font-normal text-[10px] text-[#6d7871]">
                      (renklendirilmez)
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-ink-soft leading-relaxed">{rule.descriptionTr}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted">
          Bu kelimede özel vurgulu tecvid işareti bulunmuyor (doğal akışla okunur).
        </p>
      )}
    </div>
  );
}
