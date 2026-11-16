import { allPageLabels } from "@/lib/hifz/page-data";
import { HifzSession } from "@/components/hifz/HifzSession";

export const dynamic = "force-dynamic";

export default function HifzPage() {
  return <HifzSession pageLabels={allPageLabels()} />;
}
