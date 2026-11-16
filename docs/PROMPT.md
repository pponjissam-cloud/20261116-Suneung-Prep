# 코딩 AI용 구현 프롬프트

아래 전체를 코딩 AI에 붙여 넣으세요.

---

## 🎯 작업 목표
영어 지문을 입력하면 수능 대비 학습자료 6종(단어목록, 문장별 해석, 중요 문법·구문, 문장구조분석, 수능 유형별 문제, 정답지)을 자동 생성하고, 화면 확인 및 A4 인쇄/PDF 저장이 가능한 웹앱을 만들어 주세요.

## 📋 배경 컨텍스트
- 사용자: 고등학생 및 영어 강사(학습지 제작용)
- 신규 프로젝트, 기존 코드 없음
- 모든 학습자료 UI·해설은 한국어, 지문/선택지는 영어(수능 형식 준수)

## 🔧 기술 스택
- Next.js 15 (App Router), React 19, TypeScript 5 (strict: true)
- Tailwind CSS 4
- Zod (LLM 출력 스키마 검증)
- @anthropic-ai/sdk (모델: claude-sonnet-5-5, 환경변수 ANTHROPIC_API_KEY, 서버 전용)
- 테스트: Vitest
- 패키지 매니저: pnpm

## 📝 상세 요구사항

### 필수 요구사항

**1. 입력 화면 (`/`)**
- 지문 textarea (영어 80~450단어, 실시간 단어 수 표시, 범위 밖이면 생성 버튼 비활성화 + 안내)
- 영어가 아닌 텍스트 비율이 30% 이상이면 경고
- 문제 유형 체크박스(기본 전체 선택):
  목적, 심경, 주장, 요지, 주제, 제목, 내용일치, 어법, 어휘, 빈칸추론, 무관한 문장, 순서배열, 문장삽입, 요약문완성
- 난이도 선택: 기본 / 고난도 (빈칸·순서·삽입 선택지 난이도에 반영)
- "생성하기" 버튼

**2. 처리 파이프라인 (서버, `app/api/analyze/route.ts` 등)**
1) 코드로 문장 분리 → 각 문장에 ID 부여(s1, s2…). 약어(Mr., U.S., e.g.) 및 따옴표 처리 포함. 이 결과를 모든 LLM 호출에 공통 입력으로 전달.
2) 다음 4개 호출을 Promise.allSettled로 병렬 실행:
   - vocabulary / translation / grammar / structure
3) 문제+정답 생성은 별도 호출 1개(유형이 많으면 유형 그룹별로 분할 호출). 문제와 정답·해설은 반드시 같은 응답에서 생성.
4) 모든 응답은 JSON only, Zod 검증 실패 시 에러 메시지를 포함해 최대 2회 재시도.
5) 섹션별 상태(pending/success/error)를 클라이언트에 스트리밍(SSE 또는 섹션별 개별 API 호출)하여 완료된 섹션부터 표시.

**3. 결과 화면 (`/result`) – 6개 탭 + "전체 인쇄" 버튼**

| 탭 | 내용 |
|---|---|
| ① 단어목록 | 단어, 품사, 지문 속 뜻, 발음기호, 유의어/반의어, 지문 원문 예문(해당 단어 굵게). 수능 필수 수준 이상 단어 15~30개, 지문 등장 순서 |
| ② 문장별 해석 | 문장 번호 + 원문 + 자연스러운 해석 + 직독직해(끊어 읽기 `/` 표시) |
| ③ 중요 문법·구문 | 문법 포인트명(예: 관계대명사 what, 분사구문, 가주어-진주어), 해당 문장 ID, 해당 구간 하이라이트, 설명, 유사 예문 1개. 5~10개 |
| ④ 문장구조분석 | 문장마다 S/V/O/C/M 성분 태그(색상 구분), 절 단위 [ ] 괄호, 수식 관계 화살표 또는 밑줄, 문장 형식(1~5형식) 표시 |
| ⑤ 유형별 문제 | 수능 형식 그대로: 발문(예: "다음 글의 주제로 가장 적절한 것은?"), 변형 지문(필요 시), ①~⑤ 선택지 |
| ⑥ 정답지 | 문항별 정답 번호, 해설(정답 근거 문장 ID 인용), 오답 선지별 오답 이유 |

**4. 유형별 생성 규칙**
- 어법/어휘: 지문 내 5곳에 밑줄 ①~⑤. 어법은 정확히 1곳만 틀린 형태로 변형, 어휘는 1곳만 문맥상 부적절한 단어로 교체. 변형 위치는 `{sentenceId, start, end}` 오프셋으로 받고 코드가 렌더링.
- 순서배열: 첫 부분(주어진 글) + (A)(B)(C) 분할은 LLM이 문장 ID 범위로만 지정하고, 지문 텍스트 조립은 코드가 수행. 선택지는 (A)-(C)-(B) 형식 5개.
- 문장삽입: 빼낼 문장 ID와 ①~⑤ 위치(문장 ID 사이)를 LLM이 지정, 조립은 코드가 수행.
- 무관한 문장: 새로 작성한 무관한 문장 1개를 지정 위치에 삽입, ①~⑤ 표시.
- 빈칸추론: 핵심 구/절을 빈칸 처리, 원문 구간 오프셋으로 지정.
- 요약문완성: 영어 요약문 1문장 + (A)(B) 빈칸, 선택지 5쌍.
- 내용일치: 한국어 또는 영어 선택지(수능 관례대로 한국어), 불일치/일치 발문 명시.

**5. 정답 편향 방지 및 검증 (서버 후처리)**
- 선택지 순서를 서버에서 셔플한 후 정답 인덱스 재계산 (순서배열 등 순서 자체가 의미인 유형 제외).
- 검증 함수 (실패 시 해당 항목만 재생성):
  - `validateVocab`: 모든 단어(원형/변화형)가 지문에 존재
  - `validateOffsets`: 모든 오프셋이 해당 문장 범위 내, 구간 텍스트 일치
  - `validateQuestion`: 선택지 정확히 5개, 중복 없음, answerIndex 0~4
  - `validateSentenceRefs`: 참조한 문장 ID가 모두 존재

**6. 인쇄/PDF**
- `@media print`: A4, 여백 15mm, 섹션별 `page-break-before`, 탭 UI 숨김, 학생용(정답지 제외)/교사용(전체) 인쇄 선택
- 문장구조 색상은 인쇄 시에도 구분되도록 색상 + 밑줄 스타일 병행

**7. 기록**
- localStorage에 최근 생성 10건 저장(지문 앞 50자 + 날짜), 클릭 시 재표시. 접근은 try/catch로 감싸기.

### 선택적 요구사항
1. 섹션별 "다시 생성" 버튼
2. 결과 JSON 내보내기/불러오기
3. 다크 모드

## 📐 데이터 스키마 (Zod로 정의, `lib/schema.ts`)
```ts
type Sentence = { id: string; text: string };

type VocabItem = {
  word: string; lemma: string; pos: string; meaningKo: string;
  ipa?: string; synonyms: string[]; antonyms: string[]; sentenceId: string;
};

type Translation = { sentenceId: string; natural: string; chunked: string };

type GrammarPoint = {
  title: string; sentenceId: string; start: number; end: number;
  explanation: string; example: { en: string; ko: string };
};

type StructureToken = {
  start: number; end: number;
  role: "S" | "V" | "O" | "IO" | "DO" | "C" | "OC" | "M";
  clauseDepth: number;
};
type SentenceStructure = {
  sentenceId: string; pattern: 1 | 2 | 3 | 4 | 5; tokens: StructureToken[]; note?: string;
};

type QuestionType =
  | "purpose" | "mood" | "claim" | "gist" | "topic" | "title" | "detail"
  | "grammar" | "vocabulary" | "blank" | "irrelevant" | "order" | "insertion" | "summary";

type Question = {
  id: string; type: QuestionType; stem: string;
  passageVariant?: unknown;   // 유형별 조립용 데이터 (오프셋/문장ID 기반)
  choices: string[];          // 정확히 5개
  answerIndex: number;        // 0~4
  explanation: string;
  evidenceSentenceIds: string[];
  distractorReasons: string[]; // 오답 4개 각각의 이유
};

type AnalysisResult = {
  sentences: Sentence[];
  vocabulary: VocabItem[]; translations: Translation[];
  grammar: GrammarPoint[]; structures: SentenceStructure[];
  questions: Question[];
};
```

## ⚠️ 제약사항 및 주의사항
- API 키는 절대 클라이언트에 노출 금지 (서버 라우트에서만 SDK 사용)
- API 라우트에 IP 기준 간단한 rate limit (분당 5회)
- LLM 프롬프트는 `lib/prompts/` 아래 섹션별 파일로 분리, 각 프롬프트에 JSON 출력 예시 1개 포함
- LLM이 지문 텍스트를 다시 쓰게 하지 말 것 — 텍스트 변형/조립은 오프셋·문장 ID 기반으로 코드가 수행
- `any` 사용 금지, LLM 응답은 `unknown` → Zod parse
- 한 섹션 실패가 전체 실패로 번지지 않도록 처리

## 📐 코드 스타일 가이드
- 컴포넌트 PascalCase, 함수/변수 camelCase, 파일명 kebab-case
- 구조:
  ```
  app/            (page.tsx, result/page.tsx, api/analyze/*)
  components/     (sections/VocabSection.tsx 등 섹션별 1파일)
  lib/            (schema.ts, split-sentences.ts, llm.ts, validators.ts, assemble/*.ts, prompts/*.ts)
  tests/
  ```
- 주석은 "왜"를 설명하는 곳에만, 공개 함수에는 JSDoc 1줄

## 🧪 테스트 요구사항 (Vitest)
- `split-sentences`: 약어, 따옴표, 소수점, 말줄임표 케이스
- `validators`: 각 검증 함수의 통과/실패 케이스
- `assemble/order`, `assemble/insertion`: 조립 결과 스냅샷
- 셔플 후 정답 인덱스가 원래 정답 텍스트를 가리키는지
- LLM 호출은 mock 처리 (테스트에서 실제 API 호출 금지)

## 📤 구현 순서 (단계마다 동작 확인 후 다음 단계로)
1. 프로젝트 셋업 + 스키마 + 문장 분리 + 테스트
2. 입력 화면 + 단어목록/해석 섹션 (LLM 연동, 검증, 재시도)
3. 문법·구문 + 문장구조분석 (오프셋 하이라이트 렌더링)
4. 문제 생성 + 조립 로직 + 셔플 + 정답지
5. 인쇄 CSS + 학생용/교사용 인쇄 + localStorage 기록
6. 에러 처리/진행 상태 UI 다듬기, README(.env 설정법 포함)

각 단계 완료 시 변경 파일 목록과 확인 방법을 요약해 주세요.

## 💡 참고 예시 – 문장구조 렌더링
입력: "What matters most is how you respond."
tokens → [What matters most](S, 명사절) / is(V) / [how you respond](C, 명사절) → 2형식
