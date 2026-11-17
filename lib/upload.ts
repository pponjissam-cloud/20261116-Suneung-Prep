/** 파일 업로드 공통 규칙 (클라이언트·서버 공통, 런타임 의존성 없음) */

export type UploadKind = "text" | "image" | "pdf";

/** 한 번에 올릴 수 있는 사진 수 (시험지 여러 쪽) */
export const MAX_IMAGES = 8;
/** 요청 1건 최대 크기. Vercel 등 서버리스 요청 본문 한도(약 4.5MB)보다 작게 잡는다 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
/** 업로드 전 이미지 축소 기준 (긴 변 픽셀) */
export const IMAGE_MAX_SIDE = 1800;

export const SERVER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ServerImageType = (typeof SERVER_IMAGE_TYPES)[number];

export const ACCEPT_ATTR = "image/*,.heic,.heif,application/pdf,.pdf,text/plain,.txt";

/** 파일 종류 판별. 지원하지 않으면 null */
export function classifyFile(name: string, mimeType: string): UploadKind | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (mimeType === "application/pdf" || ext === "pdf") return "pdf";
  if (mimeType === "text/plain" || ext === "txt") return "text";
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext)) return "image";
  return null;
}

/**
 * 사진·PDF에서 뽑은 글을 지문 입력용으로 정리한다.
 * - 줄 끝 하이픈으로 끊긴 단어 잇기 (experi-\nment → experiment)
 * - 줄바꿈을 공백으로, 연속 공백 정리
 * - 시험지의 밑줄 번호(①~⑤), 문장삽입 자리 "( ① )" 제거
 */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/([A-Za-z])-\n\s*([a-z])/g, "$1$2")
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

/** 빈칸(____)이 남아 있는지. 빈칸 지문은 원래 표현을 채워야 분석이 정확하다 */
export function hasBlank(text: string): boolean {
  return /_{3,}/.test(text);
}
