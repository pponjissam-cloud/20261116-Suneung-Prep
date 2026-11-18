/** HTML 단독 실행판: Next.js 경로("/result?id=…")를 해시 경로("#/result?id=…")로 바꿔 쓴다 */
export function toHash(href: string): string {
  return "#" + (href.startsWith("/") ? href : `/${href}`);
}

/** 현재 해시 경로 ("/", "/result?id=…") */
export function currentRoute(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}
