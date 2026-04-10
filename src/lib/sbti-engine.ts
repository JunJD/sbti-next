import {
  DRUNK_TRIGGER_QUESTION_ID,
  dimensionMeta,
  dimensionOrder,
  normalTypes,
  questions,
  specialQuestions,
  typeImages,
  typeLibrary,
  type AnswerMap,
  type DimensionId,
  type DimensionLevel,
  type RegularQuestion,
  type SpecialQuestion,
  type TypeCode,
  type TypeProfile,
} from "@/lib/sbti-data";

export type QuizDeckQuestion = RegularQuestion | SpecialQuestion;

export type RankedType = TypeProfile & {
  distance: number;
  exact: number;
  imageSrc: string | null;
  similarity: number;
};

export type QuizResult = {
  badge: string;
  bestNormal: RankedType;
  finalType: TypeProfile & { imageSrc: string | null };
  levels: Record<DimensionId, DimensionLevel>;
  modeKicker: string;
  ranked: RankedType[];
  rawScores: Record<DimensionId, number>;
  secondaryType: RankedType | null;
  special: boolean;
  sub: string;
};

type RandomSource = () => number;

const LEVEL_TO_NUMBER: Record<DimensionLevel, number> = {
  L: 1,
  M: 2,
  H: 3,
};

function sumToLevel(score: number): DimensionLevel {
  if (score <= 3) return "L";
  if (score === 4) return "M";
  return "H";
}

function parsePattern(pattern: string) {
  return pattern.replaceAll("-", "").split("") as DimensionLevel[];
}

function resolveType(code: TypeCode) {
  return {
    ...typeLibrary[code],
    imageSrc: typeImages[code] ?? null,
  };
}

function createSeededRandom(seed: number): RandomSource {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleRegularQuestions(random: RandomSource) {
  const shuffled = [...questions];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function buildQuestionDeck(random: RandomSource = Math.random): QuizDeckQuestion[] {
  const shuffledRegular = shuffleRegularQuestions(random);
  const insertIndex = Math.floor(random() * shuffledRegular.length) + 1;

  return [
    ...shuffledRegular.slice(0, insertIndex),
    specialQuestions[0],
    ...shuffledRegular.slice(insertIndex),
  ];
}

export function buildInitialQuestionDeck(): QuizDeckQuestion[] {
  return buildQuestionDeck(createSeededRandom(0x53425449));
}

export function getVisibleQuestions(
  shuffledQuestions: QuizDeckQuestion[],
  answers: AnswerMap,
) {
  const visibleQuestions = [...shuffledQuestions];
  const gateIndex = visibleQuestions.findIndex(
    (question) => question.id === specialQuestions[0].id,
  );

  if (gateIndex !== -1 && answers[specialQuestions[0].id] === 3) {
    visibleQuestions.splice(gateIndex + 1, 0, specialQuestions[1]);
  }

  return visibleQuestions;
}

export function countAnsweredQuestions(
  visibleQuestions: QuizDeckQuestion[],
  answers: AnswerMap,
) {
  return visibleQuestions.filter((question) => answers[question.id] !== undefined).length;
}

export function isQuizComplete(
  visibleQuestions: QuizDeckQuestion[],
  answers: AnswerMap,
) {
  return (
    visibleQuestions.length > 0 &&
    countAnsweredQuestions(visibleQuestions, answers) === visibleQuestions.length
  );
}

export function computeResult(answers: AnswerMap): QuizResult {
  const rawScores = Object.fromEntries(
    dimensionOrder.map((dimensionId) => [dimensionId, 0]),
  ) as Record<DimensionId, number>;

  for (const question of questions) {
    rawScores[question.dim] += Number(answers[question.id] ?? 0);
  }

  const levels = Object.fromEntries(
    dimensionOrder.map((dimensionId) => [dimensionId, sumToLevel(rawScores[dimensionId])]),
  ) as Record<DimensionId, DimensionLevel>;

  const userVector = dimensionOrder.map((dimensionId) => LEVEL_TO_NUMBER[levels[dimensionId]]);

  const ranked = normalTypes
    .map((typePattern) => {
      const targetVector = parsePattern(typePattern.pattern).map(
        (level) => LEVEL_TO_NUMBER[level],
      );
      let distance = 0;
      let exact = 0;

      for (let index = 0; index < targetVector.length; index += 1) {
        const diff = Math.abs(userVector[index] - targetVector[index]);
        distance += diff;

        if (diff === 0) {
          exact += 1;
        }
      }

      const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));

      return {
        ...resolveType(typePattern.code),
        distance,
        exact,
        similarity,
      };
    })
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      if (left.exact !== right.exact) {
        return right.exact - left.exact;
      }

      return right.similarity - left.similarity;
    });

  const bestNormal = ranked[0];
  const drunkTriggered = answers[DRUNK_TRIGGER_QUESTION_ID] === 2;

  let finalType = resolveType(bestNormal.code);
  let modeKicker = "你的主类型";
  let badge = `匹配度 ${bestNormal.similarity}% · 精准命中 ${bestNormal.exact}/15 维`;
  let sub = "维度命中度较高，当前结果可视为你的第一人格画像。";
  let special = false;
  let secondaryType: RankedType | null = null;

  if (drunkTriggered) {
    finalType = resolveType("DRUNK");
    modeKicker = "隐藏人格已激活";
    badge = "匹配度 100% · 酒精异常因子已接管";
    sub = "乙醇亲和性过强，系统已直接跳过常规人格审判。";
    special = true;
    secondaryType = bestNormal;
  } else if (bestNormal.similarity < 60) {
    finalType = resolveType("HHHH");
    modeKicker = "系统强制兜底";
    badge = `标准人格库最高匹配仅 ${bestNormal.similarity}%`;
    sub = "标准人格库对你的脑回路集体罢工了，于是系统把你强制分配给了 HHHH。";
    special = true;
  }

  return {
    badge,
    bestNormal,
    finalType,
    levels,
    modeKicker,
    ranked,
    rawScores,
    secondaryType,
    special,
    sub,
  };
}

export const QUIZ_META = {
  imageCount: Object.keys(typeImages).length,
  normalTypeCount: normalTypes.length,
  questionCount: questions.length,
  visibleDimensionCount: Object.keys(dimensionMeta).length,
} as const;
