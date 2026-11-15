import React from "react";
import { FileText } from "lucide-react";

interface VerseNoteFormProps {
  verseKey: string;
  noteDraft: string;
  isDifficult: boolean;
  saving: boolean;
  onNoteChange: (value: string) => void;
  onDifficultChange: (value: boolean) => void;
  onSave: () => void;
}

/** Verse note and "difficult verse" flag for the selected verse. */
export function VerseNoteForm({
  verseKey,
  noteDraft,
  isDifficult,
  saving,
  onNoteChange,
  onDifficultChange,
  onSave,
}: VerseNoteFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
          <FileText className="h-4 w-4 text-forest" />
          <span>Ayet Notu ({verseKey})</span>
        </h2>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={isDifficult}
            onChange={(e) => onDifficultChange(e.target.checked)}
            className="accent-gold"
          />
          <span>Zor Ayet</span>
        </label>
      </div>
      <textarea
        rows={3}
        value={noteDraft}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Bu ayette dikkat ettiğiniz tecvid, kelime kökü veya tefekkür notunuzu yazın..."
        className="w-full rounded-xl border border-line bg-parchment p-3 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-forest"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-deep disabled:opacity-60"
      >
        {saving ? "Kaydediliyor..." : "Notu Kaydet"}
      </button>
    </form>
  );
}
