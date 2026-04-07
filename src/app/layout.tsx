import { ReactScan } from "@/components/react-scan";
import { RootLayoutShell } from "./layout-shell";

export { metadata, viewport } from "./layout-shell";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <RootLayoutShell scan={<ReactScan />}>{children}</RootLayoutShell>;
}
