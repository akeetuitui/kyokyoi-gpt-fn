// functions/services/analyzeTasterType.js
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeTasterType(recordList) {
  const prompt = `
당신은 예술 감상 전문가입니다. 아래의 감상문들을 바탕으로 감상자의 성향을 분석해주세요.

[감상문 리스트]
${recordList.map((r, i) => `${i + 1}. ${r}`).join('\n')}

분석 기준:
- 감상자의 감정 표현 방식
- 분석적/직관적/개인적/미학적 등 감상의 방향성
- 명확한 근거를 포함한 감상자 유형 요약

결과 예시:
- 분석 요약: 감상자는 감정 중심으로 반응하며 주관적 표현을 선호함.
- 감상자 유형: 감성적 직관형
`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = {
  analyzeTasterType,
};