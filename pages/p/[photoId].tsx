import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import Head from "next/head";
import { useRouter } from "next/router";
import Carousel from "../../components/Carousel";
import { cardUrl } from "../../utils/cloudinaryUrl";
import { toFaDigits } from "../../utils/fa";
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

  const currentPhotoUrl = cardUrl(currentPhoto.public_id, currentPhoto.format);

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
  // Don't call Cloudinary at build time — env may be missing in CI.
  return {
    paths: [],
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps = async (context) => {
  const { BLUR_PLACEHOLDER, getPublicGalleryImages } = await import(
    "../../utils/photos"
  );
  const images = await getPublicGalleryImages();
  const currentPhoto = images.find(
    (img) => img.id === Number(context.params?.photoId),
  );

  if (!currentPhoto) {
    return { notFound: true, revalidate: 300 };
  }

  currentPhoto.blurDataUrl = BLUR_PLACEHOLDER;

  return {
    props: {
      currentPhoto,
    },
    revalidate: 300,
  };
};
