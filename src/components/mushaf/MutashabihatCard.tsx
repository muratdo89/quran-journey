import React from "react";
import Link from "next/link";
import { GitCompareArrows } from "lucide-react";
import type { MutashabihatMatch } from "@/lib/content/types";

interface MutashabihatCardProps {
  verseKey: string;
  matches: MutashabihatMatch[];
}

/** Similar verses (müteşâbihât) for the selected verse; renders nothing when there are none. */
export function MutashabihatCard({ verseKey, matches }: MutashabihatCardProps) {
  if (matches.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gold-line bg-gold-soft/70 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-gold-deep flex items-center gap-1.5">
          <GitCompareArrows className="h-4 w-4" />
          <span>Müteşâbihât (Benzer Ayetler · {verseKey})</span>
        </h2>
      </div>
      <div className="space-y-2">
        {matches.map((m) => (
          <Link
            key={m.targetKey}
            href={`/mushaf?page=${m.targetPage}&verse=${m.targetKey}`}
            className="block rounded-xl border border-gold-line bg-surface p-3 hover:border-forest space-y-1"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-forest">
                {m.targetKey} (Sayfa {m.targetPage})
              </span>
              <span className="rounded-md bg-gold-soft px-2 py-0.5 text-[11px] font-semibold text-gold-deep">
                %{m.similarity} benzerlik
              </span>
            </div>
            <p lang="ar" dir="rtl" translate="no" className="font-arabic text-xl text-right text-ink">
              {m.textUthmani}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
