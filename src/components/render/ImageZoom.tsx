"use client";

/**
 * Zvětšení obrázku přes celou obrazovku.
 *
 * Schémata obvodů z IEL a UML diagramy z IUS jsou v šířce sloupce
 * nečitelná, takže musí jít otevřít na celou plochu.
 */
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type ImageZoomProps = {
  src: string;
  alt: string;
  /** Náhled vykreslený na serveru – klient ho jen obalí tlačítkem. */
  children: ReactNode;
};

export function ImageZoom({ src, alt, children }: ImageZoomProps) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);
  const closer = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    // Za překryvem se nemá rolovat stránka.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closer.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function close() {
    setOpen(false);
    // Zaměření zpátky na náhled, ať se klávesnicí neztratíme.
    opener.current?.focus();
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Zvětšit obrázek: ${alt}`}
        className="block w-full cursor-zoom-in rounded-card transition-shadow duration-150 hover:shadow-lift"
      >
        {children}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={close}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="relative h-[80vh] w-full max-w-6xl rounded-card bg-white p-4">
            <Image
              src={src}
              alt={alt}
              fill
              sizes="100vw"
              unoptimized={src.toLowerCase().endsWith(".svg")}
              className="object-contain p-2"
            />
          </div>
          <button
            ref={closer}
            type="button"
            onClick={close}
            className="rounded-control bg-surface px-4 py-2 text-sm text-text shadow-lift"
          >
            Zavřít
          </button>
        </div>
      ) : null}
    </>
  );
}
