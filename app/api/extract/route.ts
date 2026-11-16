import { NextResponse, type NextRequest } from "next/server";
import { OutputRuleError, PassageUnsuitableError } from "@/lib/errors";
import { extractPassage, type ExtractInput } from "@/lib/extract";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_IMAGES, MAX_UPLOAD_BYTES, SERVER_IMAGE_TYPES, classifyFile, type ServerImageType } from "@/lib/upload";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(status: number, error: string, retryable = false) {
  return NextResponse.json({ ok: false, error, retryable }, { status });
}

/** POST /api/extract  (multipart/form-data, 필드명 "files": 이미지 최대 4장 또는 PDF 1개) */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = checkRateLimit(ip);
  if (!rl.ok) return fail(429, `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도하세요.`, true);

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail(400, "파일이 없습니다.");

  const total = files.reduce((n, f) => n + f.size, 0);
  if (total > MAX_UPLOAD_BYTES) return fail(413, `파일이 너무 큽니다 (최대 ${MAX_UPLOAD_BYTES / 1024 / 1024}MB).`);

  const kinds = files.map((f) => classifyFile(f.name, f.type));
  if (kinds.some((k) => k !== "image" && k !== "pdf")) return fail(415, "사진(JPG·PNG·WEBP) 또는 PDF만 올릴 수 있습니다.");
  if (kinds.includes("pdf") && files.length > 1) return fail(400, "PDF는 한 번에 1개만 올릴 수 있습니다.");
  if (files.length > MAX_IMAGES) return fail(400, `사진은 한 번에 최대 ${MAX_IMAGES}장까지 올릴 수 있습니다.`);

  const inputs: ExtractInput[] = [];
  for (const [i, f] of files.entries()) {
    const base64 = Buffer.from(await f.arrayBuffer()).toString("base64");
    if (kinds[i] === "pdf") {
      inputs.push({ kind: "pdf", base64 });
      continue;
    }
    if (!SERVER_IMAGE_TYPES.includes(f.type as ServerImageType))
      return fail(415, "이 사진 형식은 지원하지 않습니다. JPG나 PNG로 바꿔 올려 주세요.");
    inputs.push({ kind: "image", mediaType: f.type as ServerImageType, base64 });
  }

  try {
    const data = await extractPassage(inputs);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof PassageUnsuitableError) return fail(422, e.message);
    if (e instanceof OutputRuleError) return fail(502, "글자를 읽지 못했습니다. 다시 시도해 보세요.", true);
    console.error("[extract]", e);
    const msg = e instanceof Error && e.message.includes("ANTHROPIC_API_KEY") ? e.message : "글자 추출 중 오류가 발생했습니다.";
    return fail(500, msg, true);
  }
}
