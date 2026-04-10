"use client";

import Image from "next/image";
import QRCode from "qrcode";
import { startTransition, useEffect, useState } from "react";

import { ClickSpark } from "@/components/react-bits/click-spark";
import styles from "./sbti-app.module.css";
import {
  dimensionExplanations,
  dimensionMeta,
  dimensionOrder,
  specialQuestions,
  type AnswerMap,
} from "@/lib/sbti-data";
import {
  QUIZ_META,
  buildQuestionDeck,
  computeResult,
  countAnsweredQuestions,
  getVisibleQuestions,
  isQuizComplete,
  type QuizDeckQuestion,
  type QuizResult,
} from "@/lib/sbti-engine";

type Stage = "intro" | "quiz" | "result";

const OPTION_CODES = ["A", "B", "C", "D"];
const SHARE_CARD_URL = "https://sbti.green";

let shareCardQrCodePromise: Promise<string> | null = null;

function getShareCardQrCode() {
  if (!shareCardQrCodePromise) {
    shareCardQrCodePromise = QRCode.toDataURL(SHARE_CARD_URL, {
      color: {
        dark: "#10362d",
        light: "#ffffffff",
      },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 256,
    });
  }

  return shareCardQrCodePromise;
}

function trimDimensionName(name: string) {
  return name.replace(/^[A-Za-z0-9]+\s/, "");
}

function getSignatureTraits(result: QuizResult) {
  const highDimensions = dimensionOrder.filter((dimensionId) => result.levels[dimensionId] === "H");
  const midDimensions = dimensionOrder.filter((dimensionId) => result.levels[dimensionId] === "M");
  const lowDimensions = dimensionOrder.filter((dimensionId) => result.levels[dimensionId] === "L");
  const picked = [...highDimensions, ...midDimensions, ...lowDimensions].slice(0, 3);

  return picked.map((dimensionId) => trimDimensionName(dimensionMeta[dimensionId].name));
}

function getShareText(result: QuizResult) {
  const traits = getSignatureTraits(result).join(" / ");
  const secondType = result.ranked[1];

  return [
    `我测出了 SBTI：${result.finalType.code}（${result.finalType.cn}）`,
    `${result.finalType.intro}`,
    `匹配：${result.badge}`,
    `人格标签：${traits}`,
    secondType ? `影子人格：${secondType.code}（${secondType.cn}）${secondType.similarity}%` : "",
    `来测一下你是哪种电子人格：${SHARE_CARD_URL}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  let line = "";
  let lineCount = 0;

  for (const char of text) {
    const nextLine = `${line}${char}`;

    if (context.measureText(nextLine).width > maxWidth && line) {
      lineCount += 1;
      context.fillText(line, x, y);
      y += lineHeight;
      line = char;

      if (lineCount >= maxLines - 1) {
        break;
      }
    } else {
      line = nextLine;
    }
  }

  if (line && lineCount < maxLines) {
    context.fillText(line, x, y);
  }

  return y + lineHeight;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.closePath();
}

function loadCanvasImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load share image: ${src}`));
    image.src = src;
  });
}

async function createShareCardBlob(result: QuizResult) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  const width = 1080;
  const height = 1350;
  const traits = getSignatureTraits(result);
  const secondType = result.ranked[1];
  canvas.width = width;
  canvas.height = height;

  const [typeImage, qrCodeImage] = await Promise.all([
    result.finalType.imageSrc ? loadCanvasImage(result.finalType.imageSrc) : Promise.resolve(null),
    getShareCardQrCode().then(loadCanvasImage),
  ]);

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#fff6e8");
  gradient.addColorStop(0.44, "#e9f2e8");
  gradient.addColorStop(1, "#10362d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(217, 122, 51, 0.2)";
  context.beginPath();
  context.arc(910, 140, 260, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(15, 77, 59, 0.14)";
  context.beginPath();
  context.arc(120, 1090, 330, 0, Math.PI * 2);
  context.fill();

  drawRoundedRect(context, 64, 64, 952, 1222, 44);
  context.fillStyle = "rgba(255, 255, 255, 0.76)";
  context.fill();
  context.strokeStyle = "rgba(15, 77, 59, 0.14)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "#0f4d3b";
  context.font = "700 34px sans-serif";
  context.fillText("SBTI 电子人格报告", 112, 142);

  context.fillStyle = "#10231d";
  context.font = "900 148px serif";
  context.fillText(result.finalType.code, 112, 300);

  context.fillStyle = "#62756e";
  context.font = "700 48px sans-serif";
  context.fillText(`（${result.finalType.cn}）`, 112, 366);

  if (typeImage) {
    const box = { x: 628, y: 142, width: 300, height: 300 };
    drawRoundedRect(context, box.x, box.y, box.width, box.height, 36);
    context.save();
    context.clip();
    context.fillStyle = "rgba(255, 255, 255, 0.82)";
    context.fillRect(box.x, box.y, box.width, box.height);

    const ratio = Math.min(box.width / typeImage.width, box.height / typeImage.height);
    const drawWidth = typeImage.width * ratio;
    const drawHeight = typeImage.height * ratio;
    context.drawImage(
      typeImage,
      box.x + (box.width - drawWidth) / 2,
      box.y + (box.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    );
    context.restore();
  }

  context.fillStyle = "#10231d";
  context.font = "700 48px sans-serif";
  wrapCanvasText(context, result.finalType.intro, 112, 470, 820, 62, 2);

  context.fillStyle = "#0f4d3b";
  context.font = "700 34px sans-serif";
  context.fillText(result.badge, 112, 620);

  context.fillStyle = "#62756e";
  context.font = "400 34px sans-serif";
  wrapCanvasText(context, result.sub, 112, 684, 820, 50, 2);

  context.fillStyle = "#10231d";
  context.font = "700 34px sans-serif";
  context.fillText("我的三个人格标签", 112, 804);

  traits.forEach((trait, index) => {
    const x = 112 + index * 292;
    drawRoundedRect(context, x, 846, 250, 92, 28);
    context.fillStyle = index === 0 ? "#0f4d3b" : "rgba(15, 77, 59, 0.1)";
    context.fill();
    context.fillStyle = index === 0 ? "#ffffff" : "#0f4d3b";
    context.font = "700 32px sans-serif";
    context.fillText(trait, x + 28, 904);
  });

  if (secondType) {
    context.fillStyle = "rgba(16, 35, 29, 0.78)";
    context.font = "500 30px sans-serif";
    context.fillText(
      `影子人格：${secondType.code}（${secondType.cn}） · ${secondType.similarity}%`,
      112,
      1024,
    );
  }

  const qrBox = { x: 784, y: 1046, width: 168, height: 168 };
  drawRoundedRect(context, qrBox.x, qrBox.y, qrBox.width, qrBox.height, 28);
  context.fillStyle = "#ffffff";
  context.fill();
  context.drawImage(qrCodeImage, qrBox.x + 14, qrBox.y + 14, qrBox.width - 28, qrBox.height - 28);

  context.fillStyle = "#10231d";
  context.font = "700 38px sans-serif";
  wrapCanvasText(context, "朋友圈可晒版：不是诊断，是人设压缩包。", 112, 1120, 560, 54, 2);

  context.fillStyle = "rgba(16, 35, 29, 0.7)";
  context.font = "600 32px sans-serif";
  wrapCanvasText(context, "扫码测同款人格", 112, 1218, 560, 42, 2);

  context.fillStyle = "rgba(16, 35, 29, 0.54)";
  context.font = "500 28px sans-serif";
  context.fillText(SHARE_CARD_URL, 112, 1278);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Failed to export share card."));
    }, "image/png");
  });
}

function isSpecialQuestion(question: QuizDeckQuestion) {
  return "special" in question && question.special === true;
}

export function SbtiApp() {
  const [stage, setStage] = useState<Stage>("quiz");
  const [questionDeck, setQuestionDeck] = useState<QuizDeckQuestion[]>(() => buildQuestionDeck());
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [shareStatus, setShareStatus] = useState("");
  const [shareCardQrCode, setShareCardQrCode] = useState<string | null>(null);

  const visibleQuestions = getVisibleQuestions(questionDeck, answers);
  const answeredCount = countAnsweredQuestions(visibleQuestions, answers);
  const completion = visibleQuestions.length
    ? Math.round((answeredCount / visibleQuestions.length) * 100)
    : 0;
  const remainingCount = visibleQuestions.length - answeredCount;
  const firstUnansweredQuestionIndex = visibleQuestions.findIndex(
    (question) => answers[question.id] === undefined,
  );
  const firstUnansweredQuestion =
    firstUnansweredQuestionIndex === -1
      ? null
      : visibleQuestions[firstUnansweredQuestionIndex];
  const canSubmit = isQuizComplete(visibleQuestions, answers);
  const result = stage === "result" ? computeResult(answers) : null;
  const heroTitle =
    stage === "intro"
      ? "把 sbti.unun.dev 的题库、算法和结果图重写成本地 Next.js 版。"
      : stage === "quiz"
        ? "进来直接测，做完再看结果。"
        : "结果已经生成，算法和海报都在下面。";
  const heroLead =
    stage === "intro"
      ? "公开页面里的评分脚本已经完整拆出来了。现在这版保留原题库、原匹配逻辑、酒鬼隐藏分支和 HHHH 兜底规则，同时把交互重做成更适合手机单手操作的流程。"
      : stage === "quiz"
        ? "31 道题直接开答，题目会随机排序；做完就能看到结果、海报和二维码分享卡。"
        : "结果页保留原结果文案和海报，并把分数算法、Top 匹配和十五维解释一起展开。";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  useEffect(() => {
    if (stage !== "result") {
      return;
    }

    let active = true;

    async function prepareShareCardQrCode() {
      try {
        const dataUrl = await getShareCardQrCode();

        if (active) {
          setShareCardQrCode(dataUrl);
        }
      } catch (error) {
        console.error("Failed to create share QR code.", error);
      }
    }

    void prepareShareCardQrCode();

    return () => {
      active = false;
    };
  }, [stage]);

  function startQuiz() {
    startTransition(() => {
      setQuestionDeck(buildQuestionDeck());
      setAnswers({});
      setShareStatus("");
      setStage("quiz");
    });
  }

  function chooseAnswer(questionId: keyof AnswerMap, value: number) {
    setAnswers((currentAnswers) => {
      const nextAnswers = {
        ...currentAnswers,
        [questionId]: value,
      };

      if (questionId === specialQuestions[0].id && value !== 3) {
        delete nextAnswers[specialQuestions[1].id];
      }

      return nextAnswers;
    });
  }

  function revealResult() {
    if (!canSubmit) {
      return;
    }

    setShareStatus("");
    startTransition(() => setStage("result"));
  }

  function scrollToFirstUnansweredQuestion() {
    if (!firstUnansweredQuestion) {
      return;
    }

    const questionElement = document.getElementById(`question-${firstUnansweredQuestion.id}`);
    const progressElement = document.querySelector<HTMLElement>("[data-quiz-progress]");

    if (!questionElement || !progressElement) {
      return;
    }

    const progressBottom = progressElement.getBoundingClientRect().bottom;
    const questionTop = questionElement.getBoundingClientRect().top + window.scrollY;

    window.scrollTo({
      behavior: "smooth",
      top: Math.max(0, questionTop - progressBottom - 16),
    });
  }

  async function copyShareText() {
    if (!result) {
      return;
    }

    await navigator.clipboard.writeText(getShareText(result));
    setShareStatus("分享文案已复制，可以直接粘到朋友圈/群聊。");
  }

  async function downloadShareCard() {
    if (!result) {
      return;
    }

    setShareStatus("正在生成分享卡...");
    const blob = await createShareCardBlob(result);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `sbti-${result.finalType.code.replace(/[^a-z0-9-]/gi, "")}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setShareStatus("分享卡已生成，发朋友圈时直接选这张图。");
  }

  async function shareResult() {
    if (!result) {
      return;
    }

    const text = getShareText(result);
    const title = `我的 SBTI：${result.finalType.code}（${result.finalType.cn}）`;

    if (navigator.share) {
      const blob = await createShareCardBlob(result);
      const file = new File([blob], "sbti-share-card.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text, title });
        setShareStatus("已唤起系统分享。");
        return;
      }

      await navigator.share({ text, title });
      setShareStatus("已唤起系统分享。");
      return;
    }

    await navigator.clipboard.writeText(text);
    setShareStatus("当前浏览器不支持系统分享，已改为复制文案。");
  }

  return (
    <main className={styles.page}>
      <ClickSpark sparkColor="#d97a33" sparkRadius={28} sparkSize={12}>
        <div className={styles.ambientGlow} />
        <div className={styles.ambientMesh} />

        <section className={styles.shell}>
        <header className={`${styles.hero} ${stage !== "intro" ? styles.heroCompact : ""}`}>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>SBTI Local Rewrite</p>
            <h1>{heroTitle}</h1>
            <p className={styles.heroLead}>{heroLead}</p>

            <div className={styles.heroActions}>
              <button className={styles.primaryButton} onClick={startQuiz} type="button">
                {stage === "intro" ? "开始盲测" : answeredCount > 0 ? "重新洗牌再测" : "重新洗牌"}
              </button>
            </div>
          </div>

          {stage === "intro" ? (
            <div className={styles.heroPanel}>
              <div className={styles.metricCard}>
                <span>常规题</span>
                <strong>{QUIZ_META.questionCount}</strong>
                <p>每维 2 题，单题 1 到 3 分。</p>
              </div>
              <div className={styles.metricCard}>
                <span>维度数</span>
                <strong>{QUIZ_META.visibleDimensionCount}</strong>
                <p>先转成 L / M / H，再做人格匹配。</p>
              </div>
              <div className={styles.metricCard}>
                <span>标准人格</span>
                <strong>{QUIZ_META.normalTypeCount}</strong>
                <p>按 15 维模式做距离排序。</p>
              </div>
              <div className={styles.metricCard}>
                <span>本地海报</span>
                <strong>{QUIZ_META.imageCount}</strong>
                <p>外站结果图已全部落到本地资源。</p>
              </div>
            </div>
          ) : null}
        </header>

        {stage === "intro" ? (
          <section className={styles.introGrid}>
            <article className={styles.panel}>
              <p className={styles.sectionEyebrow}>Why It Spreads</p>
              <h2>它爆火不是因为准，是因为适合被晒</h2>
              <ul className={styles.factList}>
                <li>第一性原理：社交传播需要一个低成本的“我是谁”符号。</li>
                <li>它用四五个大写字母把复杂自我压缩成可截图的人设。</li>
                <li>文案带一点冒犯但不真正伤人，刚好触发“笑着认领”。</li>
                <li>结果不是绝对判决，而是可争辩的话题，适合拉朋友下场。</li>
              </ul>
            </article>

            <article className={styles.panel}>
              <p className={styles.sectionEyebrow}>Target Boost</p>
              <h2>目标群体是爱发截图的高表达用户</h2>
              <p className={styles.panelText}>
                核心用户不是来做心理诊断的，而是想获得一个“可转发、可吐槽、可被朋友评价”的
                社交物件。所以结果页要先服务截图和转发，其次才服务解释。
              </p>
              <div className={styles.assetPreview}>
                <span className={styles.assetChip}>朋友圈图</span>
                <span className={styles.assetChip}>群聊挑衅</span>
                <span className={styles.assetChip}>二测动机</span>
                <span className={styles.assetChip}>结果争辩</span>
              </div>
            </article>

            <article className={styles.panel}>
              <p className={styles.sectionEyebrow}>What We Upgrade</p>
              <h2>弱点是分享太弱，所以结果页要变成传播页</h2>
              <ul className={styles.factList}>
                <li>先给可发朋友圈的竖版结果卡，再给详细说明。</li>
                <li>一键复制文案、系统分享、下载 PNG，减少分享摩擦。</li>
                <li>算法不装专业诊断，只公开向量、距离和影子人格，让它“显得更可解释”。</li>
              </ul>
            </article>
          </section>
        ) : null}

        {stage === "quiz" ? (
          <section className={styles.quizSection}>
            <div className={styles.progressCard} data-quiz-progress>
              <div className={styles.progressHeader}>
                <div className={styles.progressCopy}>
                  <p className={styles.sectionEyebrow}>Blind Quiz</p>
                  <h2>题目已洗牌，维度默认隐藏</h2>
                  <p className={styles.progressSummary}>
                    {canSubmit ? "所有可见题都已完成" : `还差 ${remainingCount} 题`}
                  </p>
                </div>
                <strong className={styles.progressCount}>
                  {answeredCount} / {visibleQuestions.length}
                </strong>
              </div>

              <div className={styles.progressTrack} aria-hidden="true">
                <span style={{ width: `${completion}%` }} />
              </div>

              <p className={styles.progressHint}>
                {canSubmit
                  ? "题已经答完，可以直接出结果。"
                  : "喝酒补充题会按你的选择动态插入，先把当前可见题都做完。"}
              </p>
            </div>

            <div className={styles.questionList}>
              {visibleQuestions.map((question, index) => {
                const special = isSpecialQuestion(question);

                return (
                  <article
                    className={styles.questionCard}
                    id={`question-${question.id}`}
                    key={question.id}
                  >
                    <div className={styles.questionMeta}>
                      <span className={styles.questionBadge}>第 {index + 1} 题</span>
                      <span className={styles.questionTag}>
                        {special ? "补充题 / 可能改判" : "维度盲测"}
                      </span>
                    </div>

                    <h3 className={styles.questionTitle}>{question.text}</h3>

                    <fieldset className={styles.optionList}>
                      <legend className={styles.visuallyHidden}>{question.text}</legend>
                      {question.options.map((option, optionIndex) => {
                        const checked = answers[question.id] === option.value;

                        return (
                          <label
                            key={`${question.id}-${option.value}`}
                            className={`${styles.optionCard} ${checked ? styles.optionCardActive : ""}`}
                          >
                            <input
                              checked={checked}
                              className={styles.optionInput}
                              name={question.id}
                              onChange={() => chooseAnswer(question.id, option.value)}
                              type="radio"
                              value={option.value}
                            />
                            <span className={styles.optionCode}>
                              {OPTION_CODES[optionIndex] ?? optionIndex + 1}
                            </span>
                            <span className={styles.optionText}>{option.label}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                  </article>
                );
              })}
            </div>

            <div className={styles.quizActions}>
              <div>
                <p className={styles.quizActionLabel}>
                  {canSubmit ? `当前进度 ${completion}%` : `还差 ${remainingCount} 题`}
                </p>
                <p className={styles.quizActionText}>
                  {canSubmit
                    ? "都答完了，直接看结果。"
                    : `第 ${firstUnansweredQuestionIndex + 1} 题还没答，回去继续。`}
                </p>
              </div>

              <div className={styles.quizActionButtons}>
                {canSubmit ? (
                  <button
                    className={styles.primaryButton}
                    onClick={revealResult}
                    type="button"
                  >
                    查看结果
                  </button>
                ) : firstUnansweredQuestion ? (
                  <button
                    className={styles.secondaryButton}
                    onClick={scrollToFirstUnansweredQuestion}
                    type="button"
                  >
                    跳到第 {firstUnansweredQuestionIndex + 1} 题
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {stage === "result" && result ? (
          <section className={styles.resultSection}>
            <div className={styles.resultHero}>
              <article className={styles.posterCard}>
                <div className={styles.posterMedia}>
                  {result.finalType.imageSrc ? (
                    <Image
                      alt={`${result.finalType.code}（${result.finalType.cn}）`}
                      fill
                      priority
                      sizes="(max-width: 960px) 100vw, 38vw"
                      src={result.finalType.imageSrc}
                    />
                  ) : (
                    <div className={styles.posterFallback}>No Poster</div>
                  )}
                </div>
                <p className={styles.posterCaption}>{result.finalType.intro}</p>
              </article>

              <article className={styles.summaryCard}>
                <p className={styles.sectionEyebrow}>{result.modeKicker}</p>
                <h2 className={styles.resultTitle}>
                  {result.finalType.code}
                  <span>（{result.finalType.cn}）</span>
                </h2>
                <p className={styles.resultBadge}>{result.badge}</p>
                <p className={styles.resultLead}>{result.sub}</p>
                {result.secondaryType ? (
                  <p className={styles.secondaryNote}>
                    常规人格最接近的是 {result.secondaryType.code}（{result.secondaryType.cn}）,
                    匹配度 {result.secondaryType.similarity}%。
                  </p>
                ) : null}
                <p className={styles.resultDescription}>{result.finalType.desc}</p>

                <div className={styles.resultActions}>
                  <button className={styles.primaryButton} onClick={shareResult} type="button">
                    一键分享
                  </button>
                  <button className={styles.primaryButton} onClick={startQuiz} type="button">
                    再测一次
                  </button>
                </div>
              </article>
            </div>

            <article className={styles.sharePanel}>
              <div className={styles.sharePanelCopy}>
                <p className={styles.sectionEyebrow}>Share Card</p>
                <h3>朋友圈专用卡片</h3>
                <p>
                  这张不是详情页截图，而是重新排版过的社交卡：大字人格、匹配度、三个人格标签、
                  影子人格和一句可传播文案。朋友圈发图优先，群聊再补文案。
                </p>
                <div className={styles.shareButtons}>
                  <button className={styles.primaryButton} onClick={downloadShareCard} type="button">
                    下载分享图
                  </button>
                  <button className={styles.secondaryButton} onClick={copyShareText} type="button">
                    复制文案
                  </button>
                </div>
                {shareStatus ? <p className={styles.shareStatus}>{shareStatus}</p> : null}
              </div>

              <div className={styles.shareCardPreview} aria-label="朋友圈分享卡预览">
                <div className={styles.shareCardTop}>
                  <span>SBTI 电子人格报告</span>
                  <span>{result.badge}</span>
                </div>
                <div className={styles.shareCardBody}>
                  <div>
                    <strong>{result.finalType.code}</strong>
                    <span>（{result.finalType.cn}）</span>
                  </div>
                  {result.finalType.imageSrc ? (
                    <Image
                      alt={`${result.finalType.code} 分享卡预览`}
                      height={188}
                      src={result.finalType.imageSrc}
                      width={188}
                    />
                  ) : null}
                </div>
                <p>{result.finalType.intro}</p>
                <div className={styles.shareTraitRow}>
                  {getSignatureTraits(result).map((trait) => (
                    <span key={trait}>{trait}</span>
                  ))}
                </div>
                {result.ranked[1] ? (
                  <p className={styles.shareShadow}>
                    影子人格：{result.ranked[1].code}（{result.ranked[1].cn}）
                  </p>
                ) : null}
                <div className={styles.shareCardFooter}>
                  <div className={styles.shareCardCallout}>
                    <strong>扫码测同款人格</strong>
                    <span>{SHARE_CARD_URL}</span>
                  </div>
                  <div className={styles.shareQrBox}>
                    {shareCardQrCode ? (
                      <Image
                        alt="扫码打开 sbti.green"
                        className={styles.shareQrImage}
                        height={120}
                        src={shareCardQrCode}
                        unoptimized
                        width={120}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </article>

            <div className={styles.resultGrid}>
              <article className={styles.panel}>
                <p className={styles.sectionEyebrow}>算法公开版</p>
                <h3>分数怎么走到人格结果</h3>
                <ul className={styles.factList}>
                  <li>只统计 30 道常规题；喝酒题只负责触发隐藏分支，不参与 15 维加总。</li>
                  <li>
                    每个维度的两题直接相加，再映射成 <code>L / M / H</code>。
                  </li>
                  <li>
                    每个标准人格都有一条 15 维模板，例如{" "}
                    <code>HHH-HMH-MHH-HHH-MHM</code>。
                  </li>
                  <li>系统按逐维绝对差求总距离，距离越小越靠前；完全相同的维度越多越优先。</li>
                </ul>
                <div className={styles.formulaBox}>
                  similarity = round((1 - distance / 30) * 100)
                </div>
              </article>

              <article className={styles.panel}>
                <p className={styles.sectionEyebrow}>Top 3</p>
                <h3>最接近的常规人格</h3>
                <div className={styles.matchList}>
                  {result.ranked.slice(0, 3).map((match) => (
                    <div key={match.code} className={styles.matchItem}>
                      <div>
                        <strong>
                          {match.code}（{match.cn}）
                        </strong>
                        <p>
                          距离 {match.distance} · 精准命中 {match.exact}/15
                        </p>
                      </div>
                      <span>{match.similarity}%</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            <article className={styles.panel}>
              <p className={styles.sectionEyebrow}>十五维画像</p>
              <h3>每个维度的分数与解释</h3>
              <div className={styles.dimensionGrid}>
                {dimensionOrder.map((dimensionId) => (
                  <div key={dimensionId} className={styles.dimensionCard}>
                    <div className={styles.dimensionHeader}>
                      <div>
                        <strong>{dimensionMeta[dimensionId].name}</strong>
                        <span>{dimensionMeta[dimensionId].model}</span>
                      </div>
                      <span className={styles.dimensionScore}>
                        {result.levels[dimensionId]} / {result.rawScores[dimensionId]} 分
                      </span>
                    </div>
                    <p>{dimensionExplanations[dimensionId][result.levels[dimensionId]]}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className={styles.noteCard}>
              <p>
                这套测试仍然只是娱乐产品。现在的区别只是算法和资源都已经被本地还原，
                结果更透明，体验也更顺手，不代表它突然变成了严肃心理测量工具。
              </p>
            </article>
          </section>
        ) : null}
        </section>
      </ClickSpark>
    </main>
  );
}
