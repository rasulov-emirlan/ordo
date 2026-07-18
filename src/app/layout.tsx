import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ordo — управление сетью кофеен",
  description:
    "Персонал, смены, штрафы, камеры с видеоаналитикой, продажи и статистика — для владельцев кофеен и кафе в Кыргызстане и Центральной Азии.",
  openGraph: {
    title: "Ordo — управление сетью кофеен",
    description: "Персонал, камеры, продажи и аналитика ваших заведений в одном месте.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
