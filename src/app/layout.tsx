import type { Metadata, Viewport } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Display face for titles and the big numbers (variable weight + optical size).
const bricolage = localFont({
  src: "../../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-opsz-normal.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
});

// Applies the chosen colour theme before first paint (no flash).
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

// Some Android versions draw the page edge-to-edge under the status and
// navigation bars but report env(safe-area-inset-*) as 0, which hides the tab
// bar. In that case fall back to typical system bar heights (3-button nav).
const ANDROID_INSETS_SCRIPT = `try{if(/Android/i.test(navigator.userAgent)){document.addEventListener("DOMContentLoaded",function(){var p=document.createElement("div");p.style.cssText="position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)";document.documentElement.appendChild(p);var c=getComputedStyle(p),t=parseFloat(c.paddingTop)||0,b=parseFloat(c.paddingBottom)||0;p.remove();if(window.innerHeight>=screen.height*0.97){var s=document.documentElement.style;if(t<1)s.setProperty("--sat","28px");if(b<1)s.setProperty("--sab","48px")}})}}catch(e){}`;

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Personal calorie, macro, fibre and water tracker",
  appleWebApp: {
    capable: true,
    title: "Calories",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1311" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`h-full antialiased ${bricolage.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ANDROID_INSETS_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
