import type { NextPage } from "next";
import Head from "next/head";
import AdminGate from "../../components/AdminGate";
import UploadWorkspace from "../../components/UploadWorkspace";

const AdminUploadPage: NextPage = () => {
  return (
    <AdminGate>
      <Head>
        <title>آپلود مدیر</title>
      </Head>
      <UploadWorkspace
        mode="admin"
        title="آپلود عکس"
        subtitle="عکس‌ها مستقیم منتشر می‌شوند. می‌توانید بین صفحات جابه‌جا شوید؛ ارسال ادامه دارد."
        backHref="/admin?tab=approved"
        backLabel="بازگشت"
        successHint="در گالری منتشر شد."
      />
    </AdminGate>
  );
};

export default AdminUploadPage;
