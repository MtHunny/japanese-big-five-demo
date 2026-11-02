// 出典: https://ipip.ori.org/newBigFive5broadKey.htm の各10項目版。
export const FACTORS = Object.freeze([
  {
    id: 'extraversion', name: '外向性',
    positive: [1, 11, 21, 31, 41], negative: [6, 16, 26, 36, 46],
    description: '人との交流や、集団の中での積極的な関わりに関する因子です。得点が大きいほど、交流や自己表現に積極的であるという回答傾向を示します。',
  },
  {
    id: 'agreeableness', name: '協調性',
    positive: [7, 17, 27, 37, 42, 47], negative: [2, 12, 22, 32],
    description: '他者への関心や、気持ちへの配慮に関する因子です。得点が大きいほど、共感や思いやりに関する項目が当てはまるという回答傾向を示します。',
  },
  {
    id: 'conscientiousness', name: '誠実性',
    positive: [3, 13, 23, 33, 43, 48], negative: [8, 18, 28, 38],
    description: '計画性や整理整頓、責任を持って物事に取り組む傾向に関する因子です。得点が大きいほど、準備や整理を行い、物事に着実に取り組むという回答傾向を示します。',
  },
  {
    id: 'emotional-stability', name: '情緒安定性（神経症傾向の反転）',
    positive: [9, 19], negative: [4, 14, 24, 29, 34, 39, 44, 49],
    description: '心配や気分の変化、落ち着きに関する因子です。得点が大きいほど、落ち着いていて気分が変動しにくいという回答傾向を示します。神経症傾向とは反対向きです。',
  },
  {
    id: 'intellect-imagination', name: '開放性',
    positive: [5, 15, 25, 35, 40, 45, 50], negative: [10, 20, 30],
    description: '想像力やアイディア、抽象的な考えへの関心に関する因子です。この尺度では『知性・想像力（Intellect or Imagination）』として測定されています。得点が大きいほど、これらの項目が当てはまるという回答傾向を示します。知能検査の得点ではありません。',
  },
].map((factor) => Object.freeze({
  ...factor,
  positive: Object.freeze(factor.positive),
  negative: Object.freeze(factor.negative),
})));

export function validateScale(factors = FACTORS, itemCount = 50) {
  if (itemCount !== 50 || factors.length !== 5) throw new Error('50項目・5因子が必要です。');
  const seen = new Set();
  for (const factor of factors) {
    const items = [...factor.positive, ...factor.negative];
    if (items.length !== 10) throw new Error('各因子は10項目である必要があります。');
    for (const item of items) {
      if (!Number.isInteger(item) || item < 1 || item > itemCount || seen.has(item)) {
        throw new Error('項目番号の重複または不正な対応があります。');
      }
      seen.add(item);
    }
  }
  if (seen.size !== itemCount) throw new Error('すべての項目に因子の対応が必要です。');
  return true;
}

export function isAnswer(value) {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

export function scoreAnswers(answers) {
  if (!Array.isArray(answers) || answers.length !== 50) {
    throw new Error('50項目すべての回答が必要です。');
  }
  for (const answer of answers) {
    if (!isAnswer(answer)) throw new Error('回答には1〜5の整数が必要です。');
  }
  return FACTORS.map((factor) => ({
    id: factor.id,
    name: factor.name,
    score: factor.positive.reduce((sum, item) => sum + answers[item - 1], 0)
      + factor.negative.reduce((sum, item) => sum + 6 - answers[item - 1], 0),
  }));
}

validateScale();
