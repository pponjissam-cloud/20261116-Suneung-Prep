import type { Sentence } from "../types";
import { passageBlock } from "./common";

export function vocabularyPrompt(sentences: Sentence[]): string {
  return `${passageBlock(sentences)}

위 지문에서 수능 필수 수준 이상의 핵심 단어·숙어 15~30개를 고르세요.
- 너무 쉬운 기초 단어(the, people, go 등)는 제외합니다.
- word: 지문에 나온 철자 그대로 (예: 지문에 "acquired"로 나오면 "acquired")
- lemma: 원형 (예: "acquire"). 숙어는 원형 표현 (예: "account for")
- pos: 품사 약어 (n. / v. / adj. / adv. / prep. / conj. / phr.)
- meaningKo: 이 지문 문맥에서의 뜻
- ipa: 발음기호 (숙어는 생략 가능)
- synonyms, antonyms: 영어 단어 0~3개씩
- sentenceId: 그 단어가 나온 문장 ID
- 같은 lemma는 한 번만

출력 형식:
{"items":[{"word":"acquired","lemma":"acquire","pos":"v.","meaningKo":"습득하다","ipa":"/əˈkwaɪər/","synonyms":["obtain","gain"],"antonyms":["lose"],"sentenceId":"s2"}]}`;
}

export function translationPrompt(sentences: Sentence[]): string {
  return `${passageBlock(sentences)}

모든 문장(${sentences.length}개)을 빠짐없이 해석하세요.
- natural: 자연스러운 한국어 해석
- chunked: 직독직해. 영어 원문을 의미 단위로 " / " 로 끊고, 각 덩어리 뒤에 괄호로 해석을 붙입니다.
  예: "What matters most (가장 중요한 것은) / is (~이다) / how you respond (당신이 어떻게 반응하는가)"

출력 형식:
{"items":[{"sentenceId":"s1","natural":"...","chunked":"..."}]}`;
}

export function grammarPrompt(sentences: Sentence[]): string {
  return `${passageBlock(sentences)}

이 지문에서 수능 어법·구문 학습에 중요한 포인트 5~10개를 고르세요.
(예: 관계대명사 what, 분사구문, 가주어-진주어, 강조구문, 도치, 동격의 that, 수 일치, 병렬구조, to부정사의 의미상 주어 등)
- title: 문법 포인트 이름 (한국어)
- sentenceId: 해당 문장 ID
- phrase: 해당 문법이 쓰인 구간. 원문을 그대로 복사 (3~12단어 권장)
- explanation: 학생 눈높이의 설명 2~4문장. 시험에 어떻게 나오는지도 포함
- example: 같은 문법을 쓴 새 예문 {"en": 영어, "ko": 해석}

출력 형식:
{"items":[{"title":"관계대명사 what","sentenceId":"s1","phrase":"What matters most","explanation":"...","example":{"en":"What I need is time.","ko":"내가 필요한 것은 시간이다."}}]}`;
}

export function structurePrompt(sentences: Sentence[]): string {
  return `${passageBlock(sentences)}

모든 문장(${sentences.length}개)의 문장 구조를 분석하세요.
- tokens: 문장을 앞에서부터 순서대로 문장 성분 단위로 나눈 조각들.
  · 모든 조각의 text를 순서대로 이어 붙이면 원문 문장이 되어야 합니다 (단어를 빼거나 바꾸지 말 것, 구두점은 생략 가능).
  · role: S(주어) V(동사) O(목적어) IO(간접목적어) DO(직접목적어) C(주격보어) OC(목적격보어) M(수식어/부사구) CONJ(접속사·연결어) 중 하나
  · clause: 그 조각이 절이면 종류 (명사절, 형용사절(관계사절), 부사절 등). 아니면 생략
  · 주절 기준으로 나누고, 종속절은 한 조각으로 묶습니다.
- pattern: 주절의 문장 형식 1~5
- note: 구조상 주의할 점 한 줄 (선택)

출력 형식:
{"items":[{"sentenceId":"s1","pattern":2,"tokens":[{"text":"What matters most","role":"S","clause":"명사절"},{"text":"is","role":"V"},{"text":"how you respond","role":"C","clause":"명사절"}],"note":"주어와 보어가 모두 명사절"}]}`;
}
