import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * HTML raiz do export web — PWA instalável (manifest + SW sem cache).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#255943" />
        <meta name="application-name" content="Rally Up" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Rally Up" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="description"
          content="Desafie jogadores, rankings de clube, aulas e torneios — tênis, padel, pickleball, raquetinha e beach."
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                background: #255943;
              }
              input, textarea { outline: none !important; }
              [role="button"] { cursor: pointer !important; }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof window === "undefined") return;
                window.__pwaDeferredPrompt = null;
                window.addEventListener("beforeinstallprompt", function (e) {
                  e.preventDefault();
                  window.__pwaDeferredPrompt = e;
                  try { window.dispatchEvent(new Event("pwa-bip")); } catch (_) {}
                });
                if (!("serviceWorker" in navigator)) return;
                if (location.protocol !== "https:" && location.hostname !== "localhost") return;
                navigator.serviceWorker
                  .register("/sw.js?v=1", { updateViaCache: "none" })
                  .then(function (reg) { try { reg.update(); } catch (_) {} })
                  .catch(function () {});
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
