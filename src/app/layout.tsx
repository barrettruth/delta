import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const berkeleyMono = localFont({
  src: [
    {
      path: "../fonts/BerkeleyMono-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/BerkeleyMono-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../fonts/BerkeleyMono-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../fonts/BerkeleyMono-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

const signifier = localFont({
  src: [
    { path: "../fonts/Signifier-Regular.ttf", weight: "400", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const apercuMono = localFont({
  src: [
    { path: "../fonts/ApercuMonoProLight.ttf", weight: "300", style: "normal" },
    {
      path: "../fonts/ApercuMonoProRegular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/ApercuMonoProMedium.ttf",
      weight: "500",
      style: "normal",
    },
    { path: "../fonts/ApercuMonoProBold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "delta",
  description: "Personal todo/productivity platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${berkeleyMono.variable} ${signifier.variable} ${apercuMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
