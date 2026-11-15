"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CanonicalSurahMeta, MushafPageData } from "@/lib/content/types";
import { MADINAH_JUZ_RANGES } from "@/lib/learning-engine/analytics";

interface MushafPageNavigatorProps {
  pageData: MushafPageData;
  availableSurahs: CanonicalSurahMeta[];
}

/** Page title plus 604-page, 30-juz and 114-surah navigation. */
export function MushafPageNavigator({ pageData, availableSurahs }: MushafPageNavigatorProps) {
  const router = useRouter();
  const [pageJumpInput, setPageJumpInput] = useState(String(pageData.pageNumber));

  const pageIndex = pageData.availablePages.indexOf(pageData.pageNumber);
  const prevPage = pageIndex > 0 ? pageData.availablePages[pageIndex - 1] : null;
  const nextPage =
    pageIndex >= 0 && pageIndex + 1 < pageData.availablePages.length
      ? pageData.availablePages[pageIndex + 1]
      : null;
  const primarySection = pageData.sections[0]!;

  function handlePageJump(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(pageJumpInput);
    if (Number.isInteger(num) && num >= 1 && num <= pageData.edition.totalPages) {
      router.push(`/mushaf?page=${num}`);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1b4332]">
          <span>Medine Mushafı · Sayfa {pageData.pageNumber} / {pageData.edition.totalPages}</span>
          <span className="text-[#b08d57]">•</span>
          <span>Cüz {pageData.juzNumber}</span>
          <span className="text-[#b08d57]">•</span>
          <span>
            {pageData.sections.map((s) => s.surah.nameTurkish).join(" / ")}
          </span>
        </div>
        <h1 className="mt-1 text-xl font-bold text-[#1c241f]">
          Sayfa Odaklı Kur&apos;an Çalışması
        </h1>
      </div>

      {/* 604-Page, 30-Juz & 114-Surah Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {prevPage ? (
          <Link
            href={`/mushaf?page=${prevPage}`}
            className="inline-flex items-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] hover:bg-[#f3efe6]"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>S.{prevPage}</span>
          </Link>
        ) : null}

        <form onSubmit={handlePageJump} className="inline-flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={pageData.edition.totalPages}
            aria-label="Sayfa numarasına git (1-604)"
            value={pageJumpInput}
            onChange={(e) => setPageJumpInput(e.target.value)}
            className="w-16 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-2 text-xs font-semibold text-[#1b4332] text-center"
          />
          <button
            type="submit"
            className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#f3efe6]"
          >
            Git
          </button>
        </form>

        <select
          aria-label="Cüz seç"
          value={String(pageData.juzNumber)}
          onChange={(e) => {
            const chosen = MADINAH_JUZ_RANGES.find((j) => j.juz === Number(e.target.value));
            if (chosen) router.push(`/mushaf?page=${chosen.startPage}`);
          }}
          className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-2 text-xs font-semibold text-[#1c241f]"
        >
          {MADINAH_JUZ_RANGES.map((j) => (
            <option key={j.juz} value={String(j.juz)}>
              Cüz {j.juz} (S.{j.startPage})
            </option>
          ))}
        </select>

        <select
          aria-label="Sureye git"
          value={String(primarySection.surah.id)}
          onChange={(e) => router.push(`/mushaf?surah=${e.target.value}`)}
          className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] max-w-[200px]"
        >
          {availableSurahs.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.id}. {s.nameTurkish} (S.{s.pages[0]})
            </option>
          ))}
        </select>

        {nextPage ? (
          <Link
            href={`/mushaf?page=${nextPage}`}
            className="inline-flex items-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] hover:bg-[#f3efe6]"
          >
            <span>S.{nextPage}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
