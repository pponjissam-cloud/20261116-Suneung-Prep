import { Suspense } from "react";
import ResultView from "@/components/ResultView";

export default function ResultPage() {
  return (
    <Suspense fallback={<p className="p-10 text-center">불러오는 중…</p>}>
      <ResultView />
    </Suspense>
  );
}
