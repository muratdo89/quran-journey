import type React from "react";
import {
  BarChart3,
  BookOpenText,
  Brain,
  GraduationCap,
  Languages,
  RotateCcw,
  UserRound,
} from "lucide-react";

export interface ToolLink {
  href: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** The less-used tools: listed on İlerleme and in the sidebar's collapsed "Diğer araçlar" group. */
export const TOOLS: ToolLink[] = [
  { href: "/settings", label: "Hesap ve ayarlar", hint: "Hoca sesi, yazı boyu, bulut kaydı", icon: UserRound },
  { href: "/mushaf/detay", label: "Gelişmiş Mushaf", hint: "Renkli tecvid, notlar, ses kaydı", icon: BookOpenText },
  { href: "/vocabulary", label: "Kelimeler", hint: "Kelime ve kök çalışması", icon: Languages },
  { href: "/learn-arabic", label: "Arapça dersleri", hint: "Elif-Ba ve tecvid", icon: GraduationCap },
  { href: "/review", label: "Kelime kartları", hint: "Aralıklı tekrar kartları", icon: RotateCcw },
  { href: "/memorization", label: "Ayet ezber araçları", hint: "Sure seçerek gizle, boşluk, sırala", icon: Brain },
  { href: "/statistics", label: "Ayrıntılı istatistik", hint: "Kelime, okuma ve tecvid", icon: BarChart3 },
];
