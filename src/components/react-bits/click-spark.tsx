"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Spark = {
  angle: number;
  startTime: number;
  x: number;
  y: number;
};

type ClickSparkProps = {
  children: ReactNode;
  duration?: number;
  sparkColor?: string;
  sparkCount?: number;
  sparkRadius?: number;
  sparkSize?: number;
};

export function ClickSpark({
  children,
  duration = 420,
  sparkColor = "#d97a33",
  sparkCount = 9,
  sparkRadius = 24,
  sparkSize = 10,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;

    if (!canvas || !parent) {
      return;
    }

    const resizeCanvas = () => {
      const rect = parent.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * scale));
      canvas.height = Math.max(1, Math.floor(rect.height * scale));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    };

    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(parent);
    resizeCanvas();

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    let animationId = 0;

    const draw = (timestamp: number) => {
      const scale = window.devicePixelRatio || 1;
      context.clearRect(0, 0, canvas.width, canvas.height);

      sparksRef.current = sparksRef.current.filter((spark) => {
        const progress = (timestamp - spark.startTime) / duration;

        if (progress >= 1) {
          return false;
        }

        const eased = progress * (2 - progress);
        const distance = eased * sparkRadius * scale;
        const length = sparkSize * (1 - eased) * scale;
        const x = spark.x * scale;
        const y = spark.y * scale;
        const startX = x + distance * Math.cos(spark.angle);
        const startY = y + distance * Math.sin(spark.angle);
        const endX = x + (distance + length) * Math.cos(spark.angle);
        const endY = y + (distance + length) * Math.sin(spark.angle);

        context.strokeStyle = sparkColor;
        context.globalAlpha = 1 - progress;
        context.lineWidth = 2 * scale;
        context.lineCap = "round";
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        context.globalAlpha = 1;

        return true;
      });

      animationId = requestAnimationFrame(draw);
    };

    animationId = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animationId);
  }, [duration, sparkColor, sparkRadius, sparkSize]);

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = performance.now();

    sparksRef.current.push(
      ...Array.from({ length: sparkCount }, (_, index) => ({
        angle: (Math.PI * 2 * index) / sparkCount,
        startTime: now,
        x,
        y,
      })),
    );
  }

  return (
    <div className="click-spark-host" onClick={handleClick}>
      <canvas aria-hidden="true" className="click-spark-canvas" ref={canvasRef} />
      {children}
    </div>
  );
}
