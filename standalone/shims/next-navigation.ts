import { currentRoute, toHash } from "./router";

/** next/navigation 대체 (해시 라우팅) */
export function useRouter() {
  return {
    push(href: string) {
      window.location.hash = toHash(href).slice(1);
    },
  };
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(currentRoute().split("?")[1] ?? "");
}
