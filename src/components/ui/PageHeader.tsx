import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

interface PageHeaderProps {
  /** Which primary section this page belongs to (matches the bottom menu). */
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  /** Sibling pages that live under the same menu item. */
  related?: Array<{ href: string; label: string }>;
}

/** One header shape for every page: section, short title, one sentence, related links. */
export function PageHeader({ eyebrow, title, description, related }: PageHeaderProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">{eyebrow}</p>
      <h1 className="font-display text-[1.75rem] sm:text-[2rem] font-semibold leading-tight tracking-tight text-ink text-balance">
        {title}
      </h1>
      {description && <p className="max-w-2xl text-sm text-muted leading-relaxed">{description}</p>}
      {related && related.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1.5">
          {related.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-forest hover:bg-sand"
            >
              {r.label}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
