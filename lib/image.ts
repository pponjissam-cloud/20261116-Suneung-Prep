"use client";

import { IMAGE_MAX_SIDE } from "./upload";

/**
 * 사진을 긴 변 IMAGE_MAX_SIDE 이하의 JPEG로 줄인다.
 * - 휴대폰 사진(5~10MB)을 서버 요청 한도 안으로 줄이고
 * - HEIC 등 서버가 못 읽는 형식을 JPEG로 바꾼다 (브라우저가 해석할 수 있을 때만)
 * EXIF 회전 정보는 createImageBitmap 이 반영한다.
 */
export async function compressImage(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("이 브라우저에서 열 수 없는 사진 형식입니다 (HEIC 등). 휴대폰 설정에서 '호환성 우선'으로 찍거나 JPG로 바꿔 주세요.");
  }

  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 처리할 수 없습니다.");
  ctx.fillStyle = "#fff"; // 투명 PNG 배경
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("사진을 처리할 수 없습니다.");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
