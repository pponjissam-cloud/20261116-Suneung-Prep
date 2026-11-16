/** LLM 출력이 규칙을 어겼을 때. message 는 재시도 프롬프트에 그대로 들어간다. */
export class OutputRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputRuleError";
  }
}

/** 지문 자체가 해당 유형을 만들기에 맞지 않을 때 (재시도해도 소용없음) */
export class PassageUnsuitableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PassageUnsuitableError";
  }
}
