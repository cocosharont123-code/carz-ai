import { useCallback, useEffect, useRef, useState } from "react";

interface UseImageUploadProps {
  onUpload?: (url: string) => void;
}

export function useImageUpload({ onUpload }: UseImageUploadProps = {}) {
  const previewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        setFileName(file.name);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        previewRef.current = url;
        onUpload?.(url);
      }
    },
    [onUpload],
  );

  /**
   * Accept a file that never came from the input — a frame off the camera, say.
   *
   * The whole page downstream keys off previewUrl, so a capture has to arrive
   * the same way a chosen file does or it would need a second pipeline beside
   * the first. The previous URL is revoked here rather than leaked: on a camera
   * screen this is called once per shot, not once per visit.
   */
  const acceptFile = useCallback(
    (file: File) => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      setFileName(file.name);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      previewRef.current = url;
      onUpload?.(url);
      return url;
    },
    [onUpload],
  );

  const handleRemove = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setFileName(null);
    previewRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  return {
    previewUrl,
    fileName,
    fileInputRef,
    handleThumbnailClick,
    handleFileChange,
    handleRemove,
    acceptFile,
  };
}
