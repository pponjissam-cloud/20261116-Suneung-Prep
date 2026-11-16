import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "수능 지문 분석기",
  description: "영어 지문을 넣으면 단어·해석·문법·구조분석·유형별 문제·정답지를 만들어 줍니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
