import type { GetServerSideProps, NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { ArrowUpTrayIcon, CheckIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import Button from "../../components/ui/Button";
import PageHeader from "../../components/ui/PageHeader";
import SegmentedControl from "../../components/ui/SegmentedControl";
import { useToast } from "../../components/ui/Toast";
import { isAuthenticated } from "../../utils/auth";
import {
  invalidateAdminCache,
  type AdminPhoto,
} from "../../utils/adminCache";
import { heroUrl, thumbUrl } from "../../utils/cloudinaryUrl";
import { notifyGalleryUpdated } from "../../utils/gallerySync";
import {
  applySiteTheme,
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
  type SiteTheme,
} from "../../utils/siteSettingsShared";

const THEME_OPTIONS: { id: SiteTheme; label: string }[] = [
  { id: "dark", label: "تیره" },
  { id: "light", label: "روشن" },
];

const AdminSettings: NextPage = () => {
  const toast = useToast();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(DEFAULT_SITE_SETTINGS.title);
  const [subtitle, setSubtitle] = useState(DEFAULT_SITE_SETTINGS.subtitle);
  const [theme, setTheme] = useState<SiteTheme>(DEFAULT_SITE_SETTINGS.theme);
  const [coverPublicId, setCoverPublicId] = useState<string | null>(null);
  const [coverFormat, setCoverFormat] = useState<string | null>(null);
  const [coverVersion, setCoverVersion] = useState<number | null>(null);
  const [photos, setPhotos] = useState<AdminPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, photosRes] = await Promise.all([
          fetch("/api/admin/settings"),
          fetch("/api/admin/photos?status=approved"),
        ]);
        if (!settingsRes.ok) {
          const data = await settingsRes.json().catch(() => ({}));
          throw new Error(data.error || "بارگذاری تنظیمات ناموفق بود");
        }
        if (!photosRes.ok) {
          const data = await photosRes.json().catch(() => ({}));
          throw new Error(data.error || "بارگذاری عکس‌ها ناموفق بود");
        }
        const settingsJson = (await settingsRes.json()) as {
          settings: SiteSettings;
        };
        const photosJson = (await photosRes.json()) as { photos: AdminPhoto[] };
        if (cancelled) return;
        const loaded = {
          ...settingsJson.settings,
          theme: settingsJson.settings.theme || DEFAULT_SITE_SETTINGS.theme,
        };
        setTitle(loaded.title);
        setSubtitle(loaded.subtitle);
        setTheme(loaded.theme);
        setCoverPublicId(loaded.coverPublicId);
        setCoverFormat(loaded.coverFormat);
        setCoverVersion(loaded.coverVersion ?? null);
        setSavedSnapshot(loaded);
        setPhotos(photosJson.photos || []);
        applySiteTheme(loaded.theme);
      } catch (error: any) {
        if (!cancelled) {
          toast.error(error?.message || "بارگذاری ناموفق بود");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectCover(photo: AdminPhoto) {
    setCoverPublicId(photo.public_id);
    setCoverFormat(photo.format);
    setCoverVersion(photo.version ?? null);
  }

  function clearCover() {
    setCoverPublicId(null);
    setCoverFormat(null);
    setCoverVersion(null);
  }

  async function uploadCover(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/cover", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "آپلود کاور ناموفق بود");
      const photo = data.photo as AdminPhoto;
      setCoverPublicId(photo.public_id);
      setCoverFormat(photo.format);
      setCoverVersion(photo.version ?? null);
      setPhotos((prev) => [
        photo,
        ...prev.filter((p) => p.public_id !== photo.public_id),
      ]);
      invalidateAdminCache("approved");
      toast.success("کاور آپلود شد — ذخیره را بزنید");
    } catch (error: any) {
      toast.error(error?.message || "آپلود کاور ناموفق بود");
    } finally {
      setUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          subtitle,
          theme,
          coverPublicId,
          coverFormat,
          coverVersion,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ذخیره ناموفق بود");
      const settings = data.settings as SiteSettings;
      setTitle(settings.title);
      setSubtitle(settings.subtitle);
      setTheme(settings.theme);
      setCoverPublicId(settings.coverPublicId);
      setCoverFormat(settings.coverFormat);
      setCoverVersion(settings.coverVersion ?? null);
      setSavedSnapshot(settings);
      applySiteTheme(settings.theme);
      void notifyGalleryUpdated();
      toast.success("تنظیمات ذخیره شد");
    } catch (error: any) {
      toast.error(error?.message || "ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    if (!savedSnapshot) return;
    setTitle(savedSnapshot.title);
    setSubtitle(savedSnapshot.subtitle);
    setTheme(savedSnapshot.theme);
    setCoverPublicId(savedSnapshot.coverPublicId);
    setCoverFormat(savedSnapshot.coverFormat);
    setCoverVersion(savedSnapshot.coverVersion ?? null);
    applySiteTheme(savedSnapshot.theme);
    toast.push("تغییرات لغو شد");
  }

  const coverPreview =
    coverPublicId && coverFormat
      ? heroUrl(coverPublicId, coverFormat, coverVersion)
      : null;

  return (
    <>
      <Head>
        <title>تنظیمات گالری</title>
      </Head>
      <main className="af-admin mx-auto min-h-screen max-w-3xl px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 text-[var(--af-text)] sm:px-4 sm:py-8">
        <PageHeader
          title="تنظیمات"
          subtitle="عنوان، توضیح، تم و عکس کاور صفحه اول را از اینجا عوض کنید."
          backHref="/admin"
          backLabel="مدیریت"
          trailing={
            <Button
              type="button"
              size="sm"
              loading={saving}
              disabled={loading}
              onClick={save}
            >
              ذخیره
            </Button>
          }
        />

        {loading ? (
          <p className="text-sm text-[var(--af-muted)]">در حال بارگذاری…</p>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--af-muted)]">
                  عنوان گالری
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  className="af-focusable w-full rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] px-3 py-2.5 text-base text-[var(--af-text)]"
                  placeholder={DEFAULT_SITE_SETTINGS.title}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm text-[var(--af-muted)]">
                  متن معرفی
                </span>
                <textarea
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  maxLength={240}
                  rows={3}
                  className="af-focusable w-full resize-y rounded-[var(--af-radius-md)] border border-[var(--af-border)] bg-[var(--af-surface)] px-3 py-2.5 text-sm leading-6 text-[var(--af-text)]"
                  placeholder={DEFAULT_SITE_SETTINGS.subtitle}
                />
              </label>
              <div>
                <span className="mb-1.5 block text-sm text-[var(--af-muted)]">
                  تم سایت
                </span>
                <SegmentedControl
                  items={THEME_OPTIONS}
                  value={theme}
                  onChange={(id) => {
                    setTheme(id);
                    applySiteTheme(id);
                  }}
                />
                <p className="mt-2 text-xs text-[var(--af-muted)]">
                  پیش‌نمایش فوری است؛ برای اعمال دائمی ذخیره کنید.
                </p>
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">عکس کاور</h2>
                  <p className="mt-1 text-sm text-[var(--af-muted)]">
                    آپلود کنید یا از عکس‌های منتشرشده یکی را انتخاب کنید.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadCover(file);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="soft"
                    loading={uploading}
                    disabled={saving}
                    onClick={() => coverInputRef.current?.click()}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    آپلود کاور
                  </Button>
                  {coverPublicId && (
                    <Button size="sm" variant="ghost" onClick={clearCover}>
                      حذف کاور
                    </Button>
                  )}
                </div>
              </div>

              <div className="relative mb-4 overflow-hidden rounded-[var(--af-radius-lg)] border border-[var(--af-border)] bg-[var(--af-surface)]">
                <div className="relative flex min-h-[200px] flex-col items-center justify-end px-4 pb-8 pt-24 text-center sm:min-h-[240px]">
                  {coverPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={coverPreview}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/50 to-black/85" />
                    </>
                  ) : (
                    <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,197,140,0.12),transparent_55%)]" />
                  )}
                  <div className="relative z-10">
                    <p className="text-shine text-lg font-bold tracking-normal sm:text-xl">
                      {title || DEFAULT_SITE_SETTINGS.title}
                    </p>
                    <p className="mx-auto mt-2 max-w-[36ch] text-xs text-white/70 sm:text-sm">
                      {subtitle || DEFAULT_SITE_SETTINGS.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              {photos.length === 0 ? (
                <p className="text-sm text-[var(--af-muted)]">
                  هنوز عکس منتشرشده‌ای نیست.{" "}
                  <Link href="/admin" className="text-[var(--af-accent)]">
                    برو به مدیریت
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {photos.map((photo) => {
                    const selected = photo.public_id === coverPublicId;
                    return (
                      <button
                        key={photo.public_id}
                        type="button"
                        onClick={() => selectCover(photo)}
                        className={`af-focusable relative aspect-[3/2] overflow-hidden rounded-[var(--af-radius-sm)] border transition ${
                          selected
                            ? "border-[var(--af-accent)] ring-2 ring-[var(--af-accent)]/50"
                            : "border-[var(--af-border)] hover:border-[var(--af-border-strong)]"
                        }`}
                        title="انتخاب به‌عنوان کاور"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={thumbUrl(
                            photo.public_id,
                            photo.format,
                            photo.version,
                          )}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                        {selected && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                            <CheckIcon className="h-6 w-6 text-[var(--af-accent)]" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="sticky bottom-3 z-10 flex justify-end gap-2 sm:static">
              <Button
                type="button"
                variant="ghost"
                disabled={saving || !savedSnapshot}
                onClick={discardChanges}
              >
                لغو تغییرات
              </Button>
              <Button type="button" loading={saving} onClick={save}>
                ذخیره تغییرات
              </Button>
            </div>
          </div>
        )}
      </main>
    </>
  );
};

export default AdminSettings;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  if (!isAuthenticated(req)) {
    return {
      redirect: { destination: "/admin/login", permanent: false },
    };
  }
  return { props: {} };
};
