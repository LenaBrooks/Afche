import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import Carousel from "../../components/Carousel";
import { toFaDigits } from "../../utils/fa";
import { BLUR_PLACEHOLDER, getPublicGalleryImages } from "../../utils/photos";
import type { ImageProps } from "../../utils/types";

const Home: NextPage = ({ currentPhoto }: { currentPhoto: ImageProps }) => {
  const router = useRouter();
  const { photoId } = router.query;
  let index = Number(photoId);

  if (router.isFallback || !currentPhoto) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white/60">
        در حال بارگذاری…
      </main>
    );
  }

  const currentPhotoUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,g_auto,w_1200,h_630,f_auto,q_auto/${currentPhoto.public_id}.${currentPhoto.format}`;

  return (
    <>
      <Head>
        <title>{`عکس ${toFaDigits(index + 1)} · گالری`}</title>
        <meta property="og:image" content={currentPhotoUrl} />
        <meta name="twitter:image" content={currentPhotoUrl} />
      </Head>
      <main className="mx-auto max-w-[1960px] p-4">
        <Carousel currentPhoto={currentPhoto} index={index} />
      </main>
    </>
  );
};

export default Home;

export const getStaticPaths: GetStaticPaths = async () => {
  const images = await getPublicGalleryImages();
  return {
    paths: images.map((img) => ({
      params: { photoId: String(img.id) },
    })),
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const images = await getPublicGalleryImages();
  const currentPhoto = images.find(
    (img) => img.id === Number(context.params?.photoId),
  );

  if (!currentPhoto) {
    return { notFound: true, revalidate: 20 };
  }

  currentPhoto.blurDataUrl = BLUR_PLACEHOLDER;

  return {
    props: {
      currentPhoto,
    },
    revalidate: 20,
  };
};
