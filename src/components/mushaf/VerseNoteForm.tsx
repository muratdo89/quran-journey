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
      className="rounded-2xl border border-[#e5dec9] bg-white p-5 sm:p-6 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1c241f] flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#1b4332]" />
          <span>Ayet Notu ({verseKey})</span>
        </h2>
        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5a655e] cursor-pointer">
          <input
            type="checkbox"
            checked={isDifficult}
            onChange={(e) => onDifficultChange(e.target.checked)}
            className="accent-[#b08d57]"
          />
          <span>Zor Ayet</span>
        </label>
      </div>
      <textarea
        rows={3}
        value={noteDraft}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Bu ayette dikkat ettiğiniz tecvid, kelime kökü veya tefekkür notunuzu yazın..."
        className="w-full rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-3 text-xs text-[#1c241f] focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-[#1b4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143326] disabled:opacity-60"
      >
        {saving ? "Kaydediliyor..." : "Notu Kaydet"}
      </button>
    </form>
  );
}
