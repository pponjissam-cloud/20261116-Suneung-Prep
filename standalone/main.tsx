/**
 * HTML 단독 실행판 진입점.
 * Next.js 앱의 화면(app/page.tsx, app/result/page.tsx)을 그대로 쓰고,
 * 서버 대신 브라우저에서 Claude API를 직접 부른다 (build.mjs 가 모듈을 바꿔 끼움).
 */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import HomePage from "@/app/page";
import ResultPage from "@/app/result/page";
import ApiKeyBar from "./ApiKeyBar";
import { currentRoute } from "./shims/router";

// crypto.randomUUID 가 없는 환경(일부 file:// 열기) 대비
if (typeof crypto !== "undefined" && !("randomUUID" in crypto)) {
  Object.defineProperty(crypto, "randomUUID", {
    value: () =>
      "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
      ),
  });
}

function App() {
  const [route, setRoute] = useState(currentRoute());
  useEffect(() => {
    const on = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  return (
    <>
      <ApiKeyBar />
      {route.startsWith("/result") ? <ResultPage key={route} /> : <HomePage key={route} />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
