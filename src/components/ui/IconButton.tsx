import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./Button";

const SQUARE: Record<ButtonSize, string> = {
  sm: "size-8 p-0 [&_svg]:size-4",
  md: "size-10 p-0 [&_svg]:size-4.5",
  lg: "size-12 p-0 [&_svg]:size-5",
};

interface IconButtonOwnProps {
  /** Povinný – bez popisku je ikona pro odečítač obrazovky prázdné tlačítko. */
  "aria-label": string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export type IconButtonProps = IconButtonOwnProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof IconButtonOwnProps>;

export function IconButton({
  variant = "ghost",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonStyles(variant, size), SQUARE[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
