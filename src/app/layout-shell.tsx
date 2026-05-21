import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Providers } from "@/components/providers";
import { EARLY_KEYBOARD_BUFFER_SCRIPT } from "@/lib/early-keyboard";
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
  description: "Personal productivity platform",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#121212" },
  ],
};

export function RootLayoutShell({
  children,
  scan,
}: Readonly<{
  children: React.ReactNode;
  scan: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${berkeleyMono.variable} ${signifier.variable} ${apercuMono.variable}`}
      >
        <Script
          id="delta-early-keyboard"
          strategy="beforeInteractive"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static pre-hydration key buffer
          dangerouslySetInnerHTML={{ __html: EARLY_KEYBOARD_BUFFER_SCRIPT }}
        />
        {scan}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
