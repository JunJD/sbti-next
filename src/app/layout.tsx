import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

const notoSansSc = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const notoSerifSc = Noto_Serif_SC({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SBTI 人格测试",
  description: "31 道题测出你的电子人格，支持结果卡分享、相近人格对比和十五维画像。",
};

export const viewport: Viewport = {
  themeColor: "#143f34",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSansSc.variable} ${notoSerifSc.variable} ${jetBrainsMono.variable}`}
    >
      <body suppressHydrationWarning>
      {children}
      <Analytics />
      </body>
    </html>
  );
}
