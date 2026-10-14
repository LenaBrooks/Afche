import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import UploadWorkspace from "../../components/UploadWorkspace";
import { isAuthenticated } from "../../utils/auth";

const AdminUploadPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>آپلود مدیر</title>
      </Head>
      <UploadWorkspace
        mode="admin"
        title="آپلود عکس"
        subtitle="عکس‌ها مستقیم منتشر می‌شوند. می‌توانید بین صفحات جابه‌جا شوید؛ ارسال ادامه دارد."
        backHref="/admin"
        backLabel="مدیریت"
        successHint="در گالری منتشر شد."
      />
    </>
  );
};

export default AdminUploadPage;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAuthenticated(req)) {
    return {
      redirect: { destination: "/admin/login", permanent: false },
    };
  }
  return { props: {} };
};
