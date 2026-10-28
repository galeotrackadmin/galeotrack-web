import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConfirmationProvider } from "@/components/ui/confirmation-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { InstallButton } from "@/components/pwa/install-button";
import { appleStartupImages } from "@/lib/pwa/config";
import "@/components/pwa/pwa.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "GaleoTrack | Conservación marina", template: "%s | GaleoTrack" },
  description: "Reporta avistamientos de tiburones en Puerto Rico y contribuye a la conservación marina con GaleoTrack.",
  applicationName: "GaleoTrack",
  appleWebApp: { capable: true, title: "GaleoTrack", statusBarStyle: "black-translucent", startupImage: appleStartupImages() },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "dark",
  themeColor: "#020d1c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><ConfirmationProvider><PwaProvider>{children}<InstallButton /></PwaProvider></ConfirmationProvider></body>
    </html>
  );
}
