import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { variants } from "../utils/animationVariants";
import downloadPhoto from "../utils/downloadPhoto";
import { formatJalaliDate, toFaDigits } from "../utils/fa";
import { range } from "../utils/range";
import type { ImageProps, SharedModalProps } from "../utils/types";
import Twitter from "./Icons/Twitter";

export default function SharedModal({
  index,
  images,
  changePhotoId,
  closeModal,
  navigation,
  currentPhoto,
  direction,
}: SharedModalProps) {
  const [imageReady, setImageReady] = useState(false);

  const currentImage = images ? images[index] : currentPhoto;

  useEffect(() => {
    setImageReady(false);
  }, [index, currentImage?.public_id]);

  const filteredImages = images?.filter((img: ImageProps) =>
    range(index - 15, index + 15).includes(img.id),
  );

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (images && index < images.length - 1) {
        changePhotoId(index + 1);
      }
    },
    onSwipedRight: () => {
      if (index > 0) {
        changePhotoId(index - 1);
      }
    },
    trackMouse: true,
  });

  if (!currentImage) return null;

  return (
    <MotionConfig
      transition={{
        x: { type: "spring", stiffness: 380, damping: 36 },
        opacity: { duration: 0.18 },
      }}
    >
      <div
        className="relative z-50 flex aspect-[3/2] w-full max-w-7xl items-center wide:h-full xl:taller-than-854:h-auto"
        {...handlers}
      >
        {/* Main image */}
        <div className="w-full overflow-hidden">
          <div className="relative flex aspect-[3/2] items-center justify-center bg-black/20">
            <AnimatePresence initial={false} custom={direction} mode="popLayout">
              <motion.div
                key={currentImage.public_id}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="absolute inset-0"
              >
                <Image
                  src={`https://res.cloudinary.com/${
                    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
                  }/image/upload/c_fill,g_auto,${
                    navigation ? "w_1280,h_853" : "w_1920,h_1280"
                  },f_auto,q_auto/${currentImage.public_id}.${currentImage.format}`}
                  fill
                  className={`object-cover transition-opacity duration-200 ${
                    imageReady ? "opacity-100" : "opacity-0"
                  }`}
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  priority
                  alt="تصویر گالری"
                  onLoadingComplete={() => setImageReady(true)}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Controls — always mounted so they don't flicker with image load */}
        <div className="pointer-events-none absolute inset-0 z-[60] mx-auto flex max-w-7xl items-center justify-center">
          <div className="pointer-events-none relative aspect-[3/2] max-h-full w-full">
            {navigation && (
              <>
                {/* RTL: چپ = بعدی، راست = قبلی */}
                {images && index + 1 < images.length && (
                  <button
                    type="button"
                    aria-label="عکس بعدی"
                    className="pointer-events-auto absolute left-3 top-1/2 z-[70] -translate-y-1/2 rounded-full bg-black/55 p-3 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                    onClick={() => changePhotoId(index + 1)}
                  >
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>
                )}
                {index > 0 && (
                  <button
                    type="button"
                    aria-label="عکس قبلی"
                    className="pointer-events-auto absolute right-3 top-1/2 z-[70] -translate-y-1/2 rounded-full bg-black/55 p-3 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                    onClick={() => changePhotoId(index - 1)}
                  >
                    <ChevronRightIcon className="h-6 w-6" />
                  </button>
                )}
              </>
            )}

            <div className="pointer-events-auto absolute top-0 right-0 z-[70] flex items-center gap-2 p-3 text-white">
              {navigation ? (
                <a
                  href={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${currentImage.public_id}.${currentImage.format}`}
                  className="rounded-full bg-black/55 p-2 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                  target="_blank"
                  title="باز کردن نسخه کامل"
                  rel="noreferrer"
                >
                  <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                </a>
              ) : (
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`این عکس را ببینید: /p/${index}`)}`}
                  className="rounded-full bg-black/55 p-2 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                  target="_blank"
                  title="اشتراک‌گذاری"
                  rel="noreferrer"
                >
                  <Twitter className="h-5 w-5" />
                </a>
              )}
              <button
                type="button"
                onClick={() =>
                  downloadPhoto(
                    `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/${currentImage.public_id}.${currentImage.format}`,
                    `${index}.jpg`,
                  )
                }
                className="rounded-full bg-black/55 p-2 text-white/90 backdrop-blur-md transition hover:bg-black/75"
                title="دانلود نسخه کامل"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="pointer-events-auto absolute top-0 left-0 z-[70] flex items-center gap-2 p-3 text-white">
              <button
                type="button"
                onClick={() => closeModal()}
                className="rounded-full bg-black/55 p-2 text-white/90 backdrop-blur-md transition hover:bg-black/75"
              >
                {navigation ? (
                  <XMarkIcon className="h-5 w-5" />
                ) : (
                  <ArrowUturnLeftIcon className="h-5 w-5" />
                )}
              </button>
            </div>

            {currentImage.created_at && (
              <div
                className={`pointer-events-none absolute inset-x-0 z-[70] flex justify-center px-4 ${
                  navigation ? "bottom-[5.5rem]" : "bottom-3"
                }`}
              >
                <p className="rounded-full bg-black/60 px-4 py-1.5 font-sans text-sm font-medium text-white/95 backdrop-blur-md">
                  تاریخ انتشار: {formatJalaliDate(currentImage.created_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stable filmstrip — no width/x thrashing */}
        {navigation && filteredImages && images && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-b from-black/0 to-black/70">
            <div className="pointer-events-auto mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 py-4 scrollbar-none">
              {filteredImages.map(({ public_id, format, id }) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => changePhotoId(id)}
                  className={`relative h-12 w-[72px] shrink-0 overflow-hidden rounded-md transition ${
                    id === index
                      ? "ring-2 ring-white scale-105"
                      : "opacity-55 hover:opacity-90"
                  }`}
                >
                  <Image
                    alt={`بندانگشتی ${toFaDigits(id + 1)}`}
                    width={72}
                    height={48}
                    className="h-full w-full object-cover"
                    src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,g_auto,w_144,h_96,f_auto,q_auto/${public_id}.${format}`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
