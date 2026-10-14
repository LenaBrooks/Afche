import Document, { Head, Html, Main, NextScript } from "next/document";

const themeBootScript = `(function(){try{var p=location.pathname||"";if(p.indexOf("/admin")===0){var t=localStorage.getItem("af-admin-theme")||localStorage.getItem("af-theme");document.documentElement.setAttribute("data-theme",t==="light"||t==="dark"?t:"dark");}else{document.documentElement.setAttribute("data-theme","dark");}}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

class MyDocument extends Document {
  render() {
    return (
      <Html lang="fa" dir="rtl" data-theme="dark">
        <Head>
          <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
          <link rel="icon" href="/favicon.ico" />
          <link
            rel="preload"
            href="/fonts/Vazirmatn-Regular.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/fonts/Vazirmatn-SemiBold.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <meta
            name="description"
            content="گالری عکس — آپلود، مدیریت و نمایش تصاویر"
          />
          <meta property="og:site_name" content="گالری عکس" />
          <meta
            property="og:description"
            content="گالری عکس — آپلود، مدیریت و نمایش تصاویر"
          />
          <meta property="og:title" content="گالری عکس" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="گالری عکس" />
          <meta
            name="twitter:description"
            content="گالری عکس — آپلود، مدیریت و نمایش تصاویر"
          />
        </Head>
        <body className="bg-[var(--af-bg)] font-sans text-[var(--af-text)] antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
