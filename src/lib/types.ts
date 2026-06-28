export interface Album {
  id: string;
  title: string;
  slug: string; // public share link segment: /a/[slug]
  description?: string;
  coverPhotoId?: string;
  photoCount: number;
  createdAt: number; // epoch ms
  updatedAt: number;
}

export interface Photo {
  id: string;
  albumId: string;
  fileName: string;
  key: string; // R2 object key for the full-size image
  thumbKey: string; // R2 object key for the thumbnail
  contentType: string;
  size: number; // bytes (original)
  width?: number;
  height?: number;
  downloadCount?: number; // times this photo has been downloaded
  createdAt: number;
}

/** Album shape returned to the public album page (no internal fields needed). */
export interface PublicPhoto {
  id: string;
  fileName: string;
  url: string; // full-size image URL
  thumbUrl: string; // thumbnail URL
  width?: number;
  height?: number;
}
