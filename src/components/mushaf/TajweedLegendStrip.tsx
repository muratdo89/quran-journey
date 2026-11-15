import React from "react";
import { TAJWEED_LEGEND } from "@/lib/content/tajweed-analyzer";

/** Phase 7A: color legend for the colored Tajweed overlay, with its known limits. */
export function TajweedLegendStrip() {
  return (
    <div className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="font-bold text-[#1c241f] mr-1">Renkli Tecvid Rehberi:</span>
      {TAJWEED_LEGEND.map((rule) => (
        <span
          key={rule.category}
          title={rule.descriptionTr}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-semibold"
          style={{
            borderColor: `${rule.colorHex}40`,
            backgroundColor: rule.bgHex,
            color: rule.colorHex,
          }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rule.colorHex }} />
          <span>{rule.shortLabelTr}</span>
        </span>
      ))}
      <span className="basis-full text-[10px] text-[#6d7871] leading-snug">
        Otomatik işaretleme (Hafs, vasl okuyuş; ayet sonunda durak kabul edilir). Râ ve
        Lafzatullah kalınlığı ile ayet içi vakıf tercihleri renklendirilmez; kesin tecvid için
        hocanızla teyit edin.
      </span>
    </div>
  );
}
