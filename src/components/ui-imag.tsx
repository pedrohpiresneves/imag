/**
 * iMAG UI primitives — one canonical design language shared by every screen.
 * Base: paper white, ink black, sophisticated blue as the accent. Champagne is
 * reserved for micro-details only. All tokens live in `src/styles.css`.
 */
import * as React from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

type PageProps = React.HTMLAttributes<HTMLDivElement> & {
  width?: "wide" | "narrow" | "reader";
  bare?: boolean;
};

export function Page({ className, width = "wide", bare = false, ...rest }: PageProps) {
  const max =
    width === "narrow" ? "max-w-[720px]" : width === "reader" ? "max-w-[680px]" : "max-w-[1180px]";
  return (
    <div
      className={cn(
        "mx-auto w-full px-5 sm:px-8 lg:px-10",
        max,
        !bare && "py-8 sm:py-12",
        className,
      )}
      {...rest}
    />
  );
}

type SectionProps = React.HTMLAttributes<HTMLElement> & {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  center?: boolean;
};

export function Section({
  eyebrow,
  title,
  description,
  center,
  className,
  children,
  ...rest
}: SectionProps) {
  return (
    <section className={cn("py-10 sm:py-14", className)} {...rest}>
      {(eyebrow || title || description) && (
        <header className={cn("mb-8 sm:mb-10", center && "text-center")}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          {title ? (
            <h2
              className={cn(
                "text-[26px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink sm:text-[34px]",
                eyebrow && "mt-4",
              )}
            >
              {title}
            </h2>
          ) : null}
          {description ? (
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
              {description}
            </p>
          ) : null}
        </header>
      )}
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Eyebrow                                                                    */
/* -------------------------------------------------------------------------- */

export function Eyebrow({
  children,
  className,
  dotColor = "var(--champagne)",
}: {
  children: React.ReactNode;
  className?: string;
  dotColor?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.32em] text-[color:var(--blue)]",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-1 w-1 rounded-full"
        style={{ background: dotColor }}
      />
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padding?: "sm" | "md" | "lg" | "none";
  hover?: boolean;
  radius?: "sm" | "md" | "lg" | "xl";
};

export function Card({
  className,
  padding = "md",
  hover = false,
  radius = "lg",
  ...rest
}: CardProps) {
  const pad =
    padding === "none"
      ? ""
      : padding === "sm"
        ? "p-4 sm:p-5"
        : padding === "lg"
          ? "p-6 sm:p-8"
          : "p-5 sm:p-6";
  const rad =
    radius === "sm"
      ? "rounded-[12px]"
      : radius === "md"
        ? "rounded-[16px]"
        : radius === "xl"
          ? "rounded-[24px]"
          : "rounded-[20px]";
  return (
    <div
      className={cn(
        "bg-[color:var(--surface)] border border-[color:var(--hair)]",
        "shadow-[var(--shadow-card)]",
        rad,
        pad,
        hover &&
          "transition-transform duration-300 hover:-translate-y-[1px] hover:border-[color:var(--hair-strong)]",
        className,
      )}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent" | "danger";
type ButtonSize = "sm" | "md" | "lg";

function buttonClasses(variant: ButtonVariant, size: ButtonSize, fullWidth?: boolean) {
  const base =
    "group relative inline-flex select-none items-center justify-center gap-2 rounded-full font-medium tracking-[-0.005em] transition-transform duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-50";
  const sizing =
    size === "sm"
      ? "h-9 px-4 text-[13px]"
      : size === "lg"
        ? "h-12 px-8 text-[15px]"
        : "h-11 px-6 text-[14px]";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-[color:var(--ink)] text-white hover:-translate-y-[1px] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_8px_24px_-12px_rgba(15,23,42,0.45)]",
    secondary:
      "bg-[color:var(--surface)] text-[color:var(--ink)] border border-[color:var(--hair)] hover:border-[color:var(--hair-strong)]",
    ghost:
      "bg-transparent text-[color:var(--ink)] hover:bg-[color:var(--surface-soft)]",
    accent:
      "bg-[color:var(--blue)] text-white hover:-translate-y-[1px] shadow-[0_8px_24px_-12px_rgba(51, 92, 255,0.45)]",
    danger: "bg-[color:var(--error)] text-white hover:-translate-y-[1px]",
  };
  return cn(base, sizing, variants[variant], fullWidth && "w-full");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", fullWidth, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      {...rest}
    />
  );
});

type ButtonLinkProps = Omit<LinkProps, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonClasses(variant, size, fullWidth), className)}
      {...(rest as LinkProps)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Field primitives                                                           */
/* -------------------------------------------------------------------------- */

function fieldClasses(invalid?: boolean) {
  return cn(
    "h-11 w-full rounded-[12px] bg-[color:var(--surface)] px-4 text-[14px] text-[color:var(--ink)]",
    "border border-[color:var(--hair)] placeholder:text-[color:var(--text-muted)]",
    "transition focus:outline-none focus:border-[color:var(--blue)] focus:shadow-[var(--shadow-focus)]",
    invalid && "border-[color:var(--error)] focus:border-[color:var(--error)]",
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldClasses(invalid), className)} {...rest} />;
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldClasses(invalid), "h-auto min-h-[96px] py-3 leading-relaxed", className)}
      {...rest}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* Divider, Chip, Badge                                                       */
/* -------------------------------------------------------------------------- */

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("h-px w-full border-0 bg-[color:var(--divider)]", className)} />;
}

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "blue" | "champagne" | "success" | "error";
};
export function Chip({ className, tone = "neutral", ...rest }: ChipProps) {
  const tones: Record<NonNullable<ChipProps["tone"]>, string> = {
    neutral:
      "bg-[color:var(--surface-soft)] text-[color:var(--text-secondary)] border border-[color:var(--hair)]",
    blue: "bg-[color:var(--blue-tint)] text-[color:var(--blue)]",
    champagne: "bg-[rgba(198,161,91,0.10)] text-[color:var(--champagne)]",
    success: "bg-[rgba(15,118,110,0.10)] text-[color:var(--success)]",
    error: "bg-[rgba(185,28,28,0.10)] text-[color:var(--error)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[-0.005em]",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* State views (empty / loading / error / success)                            */
/* -------------------------------------------------------------------------- */

type StateProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "neutral" | "success" | "error";
  className?: string;
};

function stateIconColor(tone: StateProps["tone"]) {
  if (tone === "success") return "var(--success)";
  if (tone === "error") return "var(--error)";
  return "var(--blue)";
}

export function StateView({ icon, title, description, action, tone = "neutral", className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-[20px] border border-[color:var(--hair)] bg-[color:var(--surface)] px-6 py-10 text-center sm:px-10 sm:py-12",
        className,
      )}
    >
      {icon ? (
        <div
          className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-[color:var(--hair)] bg-white"
          style={{ color: stateIconColor(tone) }}
        >
          {icon}
        </div>
      ) : null}
      <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[color:var(--ink)]">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Carregando…", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[20px] border border-[color:var(--hair)] bg-[color:var(--surface)] px-6 py-12 text-center",
        className,
      )}
    >
      <div
        aria-hidden
        className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--hair-strong)] border-t-[color:var(--blue)]"
      />
      <p className="text-[13px] text-[color:var(--text-secondary)]">{label}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAG message bubble                                                         */
/* -------------------------------------------------------------------------- */

export function MagMessage({
  children,
  icon,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[16px] border border-[color:var(--hair)] bg-[color:var(--surface-soft)] p-4",
        className,
      )}
    >
      {icon ? (
        <div
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[color:var(--hair)] bg-white"
          style={{ color: "var(--champagne)" }}
        >
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
        <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--blue)]">
          MAG
        </div>
        {children}
      </div>
    </div>
  );
}