import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUturnLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import { variants } from "../utils/animationVariants";
import downloadPhoto from "../utils/downloadPhoto";
import { formatJalaliDate, toFaDigits } from "../utils/fa";
import {
  filmstripUrl,
  lightboxUrl,
  originalUrl,
} from "../utils/cloudinaryUrl";
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
  const mainImgRef = useRef<HTMLImageElement>(null);
  const [imageReady, setImageReady] = useState(false);

  const currentImage = images ? images[index] : currentPhoto;

  useLayoutEffect(() => {
    setImageReady(false);
    const img = mainImgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setImageReady(true);
    }
  }, [index, currentImage?.public_id, currentImage?.version]);

  useEffect(() => {
    if (!images || !currentImage) return;
    const neighbors = [images[index - 1], images[index + 1]].filter(Boolean);
    neighbors.forEach((img) => {
      const el = new window.Image();
      el.src = lightboxUrl(
        img.public_id,
        img.format,
        !navigation,
        img.version,
      );
    });
  }, [images, index, navigation, currentImage]);

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

  const mainSrc = lightboxUrl(
    currentImage.public_id,
    currentImage.format,
    !navigation,
    currentImage.version,
  );
  const fullSrc = originalUrl(
    currentImage.public_id,
    currentImage.format,
    currentImage.version,
  );

  const aspect =
    currentImage.width > 0 && currentImage.height > 0
      ? currentImage.width / currentImage.height
      : 3 / 2;

  return (
    <MotionConfig
      transition={{
        x: { type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.18, ease: "easeOut" },
      }}
    >
      <div
        className={`relative z-50 flex w-full max-w-5xl items-center justify-center px-2 ${
          navigation ? "max-h-[min(85vh,900px)] pb-16" : "max-h-[90vh]"
        }`}
        {...handlers}
      >
        <div className="relative flex max-h-[inherit] w-full items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.div
              key={currentImage.public_id}
              custom={direction ?? 0}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex max-h-[inherit] w-full items-center justify-center"
            >
              <div
                className="relative w-full max-w-full"
                style={{
                  aspectRatio: String(aspect),
                  maxHeight: "min(85vh, 900px)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={mainImgRef}
                  src={mainSrc}
                  alt="تصویر گالری"
                  width={currentImage.width}
                  height={currentImage.height}
                  className={`absolute inset-0 mx-auto h-full w-full object-contain transition-opacity duration-200 ease-out ${
                    imageReady ? "opacity-100" : "opacity-0"
                  }`}
                  decoding="async"
                  fetchPriority="high"
                  onLoad={() => setImageReady(true)}
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="pointer-events-none absolute inset-0 z-[60]">
          {navigation && (
            <>
              {images && index + 1 < images.length && (
                <button
                  type="button"
                  aria-label="عکس بعدی"
                  className="pointer-events-auto absolute left-3 top-1/2 z-[70] -translate-y-1/2 rounded-full bg-black/55 p-3 text-white/90 transition hover:bg-black/75"
                  onClick={() => changePhotoId(index + 1)}
                >
                  <ChevronLeftIcon className="h-6 w-6" />
                </button>
              )}
              {index > 0 && (
                <button
                  type="button"
                  aria-label="عکس قبلی"
                  className="pointer-events-auto absolute right-3 top-1/2 z-[70] -translate-y-1/2 rounded-full bg-black/55 p-3 text-white/90 transition hover:bg-black/75"
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
                href={fullSrc}
                className="rounded-full bg-black/55 p-2 text-white/90 transition hover:bg-black/75"
                target="_blank"
                title="باز کردن نسخه کامل"
                rel="noreferrer"
              >
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
              </a>
            ) : (
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`این عکس را ببینید: /p/${index}`)}`}
                className="rounded-full bg-black/55 p-2 text-white/90 transition hover:bg-black/75"
                target="_blank"
                title="اشتراک‌گذاری"
                rel="noreferrer"
              >
                <Twitter className="h-5 w-5" />
              </a>
            )}
            <button
              type="button"
              onClick={() => downloadPhoto(fullSrc, `${index}.jpg`)}
              className="rounded-full bg-black/55 p-2 text-white/90 transition hover:bg-black/75"
              title="دانلود نسخه کامل"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="pointer-events-auto absolute top-0 left-0 z-[70] flex items-center gap-2 p-3 text-white">
            <button
              type="button"
              onClick={() => closeModal()}
              className="rounded-full bg-black/55 p-2 text-white/90 transition hover:bg-black/75"
            >
              {navigation ? (
                <XMarkIcon className="h-5 w-5" />
              ) : (
                <ArrowUturnLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>

          {currentImage.created_at && (
            <p
              className={`pointer-events-none absolute left-3 z-[70] fa-num text-[10px] text-white/60 ${
                navigation ? "bottom-[4.75rem]" : "bottom-3"
              }`}
            >
              {formatJalaliDate(currentImage.created_at)}
            </p>
          )}
        </div>

        {navigation && filteredImages && images && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-b from-black/0 to-black/70">
            <div className="pointer-events-auto mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-4 py-4 scrollbar-none">
              {filteredImages.map(({ public_id, format, version, id }) => (
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`بندانگشتی ${toFaDigits(id + 1)}`}
                    width={72}
                    height={48}
                    className="h-full w-full object-cover"
                    src={filmstripUrl(public_id, format, version)}
                    loading="lazy"
                    decoding="async"
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
