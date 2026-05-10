"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { SidebarProvider } from "@/components/ui/sidebar";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>{children}</SidebarProvider>
      <Toaster
        theme="system"
        position="bottom-right"
        toastOptions={{
          className: "bg-card text-card-foreground border-border",
        }}
      />
    </ThemeProvider>
  );
}
