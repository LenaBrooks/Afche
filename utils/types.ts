/* eslint-disable no-unused-vars */
export interface ImageProps {
  id: number;
  height: number;
  width: number;
  public_id: string;
  format: string;
  /** Cloudinary asset version — enables immutable CDN URLs. */
  version?: number;
  blurDataUrl?: string;
  /** Upload or publish time (ISO). Prefer approved_at when present. */
  created_at?: string | null;
  bytes?: number | null;
  filename?: string | null;
}

export interface SharedModalProps {
  index: number;
  images?: ImageProps[];
  currentPhoto?: ImageProps;
  changePhotoId: (newVal: number) => void;
  closeModal: () => void;
  navigation: boolean;
  direction?: number;
}
