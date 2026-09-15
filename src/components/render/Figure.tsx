/**
 * Obrázek k otázce – schéma obvodu, K-mapa, UML diagram, graf.
 *
 * Server Component; klientský je jen lightbox (ImageZoom).
 */
import Image from "next/image";

import type { ImageRef } from "@/content/schema";
import { cn } from "@/lib/cn";

import { ImageZoom } from "./ImageZoom";

export type FigureProps = ImageRef & {
  className?: string;
  /** Vypnutí zvětšení – např. u drobného obrázku v možnosti odpovědi. */
  zoomable?: boolean;
  priority?: boolean;
};

export function Figure({
  src,
  alt,
  caption,
  width,
  height,
  className,
  zoomable = true,
  priority = false,
}: FigureProps) {
  // Optimalizátor Next.js SVG standardně odmítá; posíláme ho beze změny.
  const unoptimized = src.toLowerCase().endsWith(".svg");
  const hasSize = typeof width === "number" && typeof height === "number";

  const image = hasSize ? (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      unoptimized={unoptimized}
      sizes="(max-width: 768px) 100vw, 720px"
      className="mx-auto h-auto w-full max-w-full"
    />
  ) : (
    // Bez rozměrů ze schématu držíme aspoň poměr stran, ať stránka neposkakuje.
    <span className="relative block aspect-[16/10] w-full">
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        unoptimized={unoptimized}
        sizes="(max-width: 768px) 100vw, 720px"
        className="object-contain"
      />
    </span>
  );

  /* Schémata a diagramy jsou skoro vždy černé čáry na průhledném pozadí –
     v tmavém režimu by zmizely, proto světlá podložka v obou režimech. */
  const frame = (
    <span className="block rounded-card border border-border-base bg-white p-3">{image}</span>
  );

  return (
    <figure className={cn("my-4", className)}>
      {zoomable ? (
        <ImageZoom src={src} alt={alt}>
          {frame}
        </ImageZoom>
      ) : (
        frame
      )}
      {caption ? (
        <figcaption className="mt-2 max-w-[68ch] text-sm text-text-muted italic">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
