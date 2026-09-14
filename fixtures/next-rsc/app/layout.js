import Script from "next/script";

export const metadata = { title: "next-rsc-fixture" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Must install the DevTools hook before Next's React chunks load. */}
        <Script src="/auto.global.js" strategy="beforeInteractive" />
      </head>
      <body>{children}</body>
    </html>
  );
}
