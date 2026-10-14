import Document, { Head, Html, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html lang="fa" dir="rtl">
        <Head>
          <link rel="icon" href="/favicon.ico" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap"
            rel="stylesheet"
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
        <body className="bg-black font-sans antialiased">
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
