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
      router.push(`/mushaf/detay?page=${num}`);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">
          Sayfa {pageData.pageNumber} / {pageData.edition.totalPages} · {pageData.juzNumber}. Cüz ·{" "}
          {pageData.hizbNumber}. Hizb
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          {pageData.sections.map((s) => s.surah.nameTurkish).join(" · ")}
        </h1>
      </div>

      {/* 604-Page, 30-Juz & 114-Surah Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        {prevPage ? (
          <Link
            href={`/mushaf/detay?page=${prevPage}`}
            className="order-1 lg:order-none inline-flex items-center gap-1 rounded-xl border border-line bg-parchment px-3 py-2 text-xs font-semibold text-ink hover:bg-sand"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>S.{prevPage}</span>
          </Link>
        ) : null}

        <form onSubmit={handlePageJump} className="order-2 lg:order-none inline-flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={pageData.edition.totalPages}
            aria-label="Sayfa numarasına git (1-604)"
            value={pageJumpInput}
            onChange={(e) => setPageJumpInput(e.target.value)}
            className="w-16 rounded-xl border border-line bg-parchment px-2.5 py-2 text-xs font-semibold text-forest text-center"
          />
          <button
            type="submit"
            className="rounded-xl border border-line bg-parchment px-2.5 py-2 text-xs font-semibold text-forest hover:bg-sand"
          >
            Git
          </button>
        </form>

        <select
          aria-label="Cüz seç"
          value={String(pageData.juzNumber)}
          onChange={(e) => {
            const chosen = MADINAH_JUZ_RANGES.find((j) => j.juz === Number(e.target.value));
            if (chosen) router.push(`/mushaf/detay?page=${chosen.startPage}`);
          }}
          className="order-4 lg:order-none min-w-0 flex-[1_1_7rem] lg:flex-none rounded-xl border border-line bg-parchment px-2.5 py-2 text-xs font-semibold text-ink"
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
          onChange={(e) => router.push(`/mushaf/detay?surah=${e.target.value}`)}
          className="order-5 lg:order-none min-w-0 flex-[2_1_10rem] lg:flex-none rounded-xl border border-line bg-parchment px-3 py-2 text-xs font-semibold text-ink lg:max-w-[200px]"
        >
          {availableSurahs.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.id}. {s.nameTurkish} (S.{s.pages[0]})
            </option>
          ))}
        </select>

        {nextPage ? (
          <Link
            href={`/mushaf/detay?page=${nextPage}`}
            className="order-3 lg:order-none inline-flex items-center gap-1 rounded-xl border border-line bg-parchment px-3 py-2 text-xs font-semibold text-ink hover:bg-sand"
          >
            <span>S.{nextPage}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
