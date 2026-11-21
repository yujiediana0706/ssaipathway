"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import QRCode from "qrcode";

interface Props {
  code: string;
  link: string;
  onClose: () => void;
}

/**
 * 邀请码二维码弹层
 * - 二维码内容即完整邀请链接，前端生成，不走后端接口
 * - PNG 导出 640px 纯渲染尺寸，足够扫码
 */
export default function InviteQrModal({ code, link, onClose }: Props) {
  const isEn = useLocale() === "en";
  const label = (zh: string, en: string) => (isEn ? en : zh);
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl("");
    setFailed(false);
    // 客户端生成，避免 SSR 阶段访问 canvas
    QRCode.toDataURL(link, { width: 640, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [link]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `invite-${code}.png`;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {label("邀请二维码", "Invite QR code")}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{code}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={label("关闭", "Close")}
            className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex min-h-[240px] items-center justify-center rounded-xl border border-border bg-white p-3">
          {failed ? (
            <p className="text-xs text-amber-800">
              {label("二维码生成失败，请重试。", "Failed to generate QR code, please retry.")}
            </p>
          ) : dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt={label("邀请二维码", "Invite QR code")} width={240} height={240} />
          ) : (
            <p className="text-xs text-muted-foreground">{label("生成中…", "Generating…")}</p>
          )}
        </div>

        <p className="mt-3 break-all text-[11px] leading-relaxed text-muted-foreground">{link}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={download}
            disabled={!dataUrl}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {label("下载 PNG", "Download PNG")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            {label("关闭", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
