import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { notifyGalleryUpdated } from "../utils/gallerySync";
import { toFaDigits } from "../utils/fa";

export type UploadMode = "public" | "admin";

export type QueueItem = {
  id: string;
  file: File;
  preview: string;
  status: "waiting" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  mode: UploadMode;
};

type UploadConfig = {
  cloudName: string;
  folder: string;
  uploadPreset: string | null;
  direct: boolean;
};

type UploadApi = {
  items: QueueItem[];
  uploading: boolean;
  overallProgress: number;
  activeCount: number;
  addFiles: (files: FileList | File[], mode: UploadMode) => string[];
  removeItem: (id: string) => void;
  clearDone: () => void;
  clearQueue: (mode?: UploadMode) => void;
  cancelItem: (id: string) => void;
  cancelAll: (mode?: UploadMode) => void;
  startUpload: (mode: UploadMode) => Promise<{ ok: number; fail: number }>;
  itemsFor: (mode: UploadMode) => QueueItem[];
};

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 30;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

const UploadContext = createContext<UploadApi | null>(null);

let cachedUploadConfig: UploadConfig | null = null;

async function getUploadConfig(): Promise<UploadConfig> {
  if (cachedUploadConfig) return cachedUploadConfig;
  const res = await fetch("/api/upload/config");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "پیکربندی آپلود در دسترس نیست");
  cachedUploadConfig = data as UploadConfig;
  return cachedUploadConfig;
}

function xhrUpload(
  url: string,
  body: FormData,
  onProgress: (n: number) => void,
  register: (xhr: XMLHttpRequest) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("POST", url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      reject(new Error(data.error || data?.error?.message || "آپلود ناموفق بود"));
    };
    xhr.onerror = () => reject(new Error("خطای شبکه. دوباره تلاش کنید."));
    xhr.onabort = () => reject(new Error("آپلود لغو شد"));
    xhr.send(body);
  });
}

export function UploadQueueProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const xhrMap = useRef(new Map<string, XMLHttpRequest>());
  const cancelledIds = useRef(new Set<string>());
  const runLock = useRef(false);

  const patchItem = useCallback(
    (id: string, patch: Partial<QueueItem>) => {
      setItems((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      );
    },
    [],
  );

  const addFiles = useCallback((list: FileList | File[], mode: UploadMode) => {
    const incoming = Array.from(list);
    const errors: string[] = [];
    const next: QueueItem[] = [];

    for (const file of incoming) {
      if (!ALLOWED.has(file.type)) {
        errors.push(`${file.name}: فرمت مجاز نیست`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: بیشتر از ۱۰ مگابایت`);
        continue;
      }
      next.push({
        id: `${mode}-${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        preview: URL.createObjectURL(file),
        status: "waiting",
        progress: 0,
        mode,
      });
    }

    setItems((prev) => {
      const sameMode = prev.filter((p) => p.mode === mode);
      const room = MAX_FILES - sameMode.length;
      if (next.length > room) {
        errors.push(`حداکثر ${toFaDigits(MAX_FILES)} فایل در صف`);
      }
      const accepted = next.slice(0, Math.max(0, room));
      // revoke unused previews
      next.slice(accepted.length).forEach((p) => URL.revokeObjectURL(p.preview));
      return [...prev, ...accepted];
    });

    return errors;
  }, []);

  const removeItem = useCallback((id: string) => {
    const xhr = xhrMap.current.get(id);
    if (xhr) {
      cancelledIds.current.add(id);
      xhr.abort();
      xhrMap.current.delete(id);
    }
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const cancelItem = useCallback(
    (id: string) => {
      removeItem(id);
    },
    [removeItem],
  );

  const clearDone = useCallback(() => {
    setItems((prev) => {
      prev
        .filter((p) => p.status === "done")
        .forEach((p) => URL.revokeObjectURL(p.preview));
      return prev.filter((p) => p.status !== "done");
    });
  }, []);

  const clearQueue = useCallback((mode?: UploadMode) => {
    setItems((prev) => {
      const keep: QueueItem[] = [];
      for (const item of prev) {
        if (mode && item.mode !== mode) {
          keep.push(item);
          continue;
        }
        const xhr = xhrMap.current.get(item.id);
        if (xhr) {
          cancelledIds.current.add(item.id);
          xhr.abort();
          xhrMap.current.delete(item.id);
        }
        URL.revokeObjectURL(item.preview);
      }
      return keep;
    });
  }, []);

  const cancelAll = useCallback(
    (mode?: UploadMode) => {
      clearQueue(mode);
      setUploading(false);
      runLock.current = false;
    },
    [clearQueue],
  );

  const uploadOneFile = useCallback(
    async (item: QueueItem) => {
      cancelledIds.current.delete(item.id);
      patchItem(item.id, {
        status: "uploading",
        progress: 0,
        error: undefined,
      });

      const register = (xhr: XMLHttpRequest) => {
        xhrMap.current.set(item.id, xhr);
      };
      const onProgress = (n: number) => patchItem(item.id, { progress: n });

      try {
        if (item.mode === "admin") {
          const body = new FormData();
          body.append("file", item.file);
          await xhrUpload("/api/admin/upload", body, onProgress, register);
        } else {
          let usedDirect = false;
          try {
            const config = await getUploadConfig();
            if (config.direct && config.uploadPreset) {
              usedDirect = true;
              const body = new FormData();
              body.append("file", item.file);
              body.append("upload_preset", config.uploadPreset);
              body.append("folder", config.folder);
              body.append("tags", "pending");
              body.append(
                "context",
                `original_filename=${item.file.name.replace(/[|=]/g, "_") || "photo"}`,
              );
              await xhrUpload(
                `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
                body,
                onProgress,
                register,
              );
            }
          } catch {
            usedDirect = false;
          }
          if (!usedDirect) {
            const body = new FormData();
            body.append("file", item.file);
            await xhrUpload("/api/upload", body, onProgress, register);
          }
        }

        if (cancelledIds.current.has(item.id)) return "cancelled" as const;
        patchItem(item.id, { status: "done", progress: 100 });
        return "ok" as const;
      } catch (err: any) {
        if (cancelledIds.current.has(item.id)) return "cancelled" as const;
        const msg = err?.message || "ناموفق";
        if (msg.includes("لغو")) return "cancelled" as const;
        patchItem(item.id, {
          status: "error",
          progress: 0,
          error: msg,
        });
        return "fail" as const;
      } finally {
        xhrMap.current.delete(item.id);
      }
    },
    [patchItem],
  );

  const startUpload = useCallback(
    async (mode: UploadMode) => {
      if (runLock.current) return { ok: 0, fail: 0 };
      runLock.current = true;
      setUploading(true);

      // Re-queue previous errors for this run
      setItems((prev) =>
        prev.map((p) =>
          p.mode === mode && p.status === "error"
            ? { ...p, status: "waiting", error: undefined, progress: 0 }
            : p,
        ),
      );

      let ok = 0;
      let fail = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const snapshot = await new Promise<QueueItem[]>((resolve) => {
          setItems((prev) => {
            resolve(prev);
            return prev;
          });
        });
        const next = snapshot.find(
          (p) => p.mode === mode && p.status === "waiting",
        );
        if (!next) break;

        const result = await uploadOneFile(next);
        if (result === "ok") ok += 1;
        if (result === "fail") fail += 1;
      }

      if (mode === "admin" && ok > 0) {
        void notifyGalleryUpdated();
      }

      setUploading(false);
      runLock.current = false;
      return { ok, fail };
    },
    [uploadOneFile],
  );

  const itemsFor = useCallback(
    (mode: UploadMode) => items.filter((p) => p.mode === mode),
    [items],
  );

  const overallProgress = useMemo(() => {
    const active = items.filter(
      (p) =>
        p.status === "waiting" ||
        p.status === "uploading" ||
        p.status === "done" ||
        p.status === "error",
    );
    if (active.length === 0) return 0;
    const sum = active.reduce((acc, item) => {
      if (item.status === "done" || item.status === "error") return acc + 100;
      return acc + item.progress;
    }, 0);
    return Math.round(sum / active.length);
  }, [items]);

  const activeCount = useMemo(
    () =>
      items.filter(
        (p) => p.status === "waiting" || p.status === "uploading",
      ).length,
    [items],
  );

  const api = useMemo<UploadApi>(
    () => ({
      items,
      uploading,
      overallProgress,
      activeCount,
      addFiles,
      removeItem,
      clearDone,
      clearQueue,
      cancelItem,
      cancelAll,
      startUpload,
      itemsFor,
    }),
    [
      items,
      uploading,
      overallProgress,
      activeCount,
      addFiles,
      removeItem,
      clearDone,
      clearQueue,
      cancelItem,
      cancelAll,
      startUpload,
      itemsFor,
    ],
  );

  return (
    <UploadContext.Provider value={api}>{children}</UploadContext.Provider>
  );
}

export function useUploadQueue() {
  const ctx = useContext(UploadContext);
  if (!ctx) {
    throw new Error("useUploadQueue must be used within UploadQueueProvider");
  }
  return ctx;
}
