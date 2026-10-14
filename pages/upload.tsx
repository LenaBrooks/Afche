import type { NextPage } from "next";
import Head from "next/head";
import UploadWorkspace from "../components/UploadWorkspace";

const UploadPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>آپلود عکس</title>
      </Head>
      <UploadWorkspace
        mode="public"
        title="آپلود عکس"
        subtitle="عکس‌ها بعد از تأیید مدیر در گالری منتشر می‌شوند. می‌توانید به گالری بروید؛ ارسال در پس‌زمینه ادامه دارد."
        backHref="/"
        backLabel="گالری"
        successHint="در صف تأیید مدیر قرار گرفت."
      />
    </>
  );
};

export default UploadPage;
