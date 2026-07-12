import { Fragment } from "react";
import {
  parseArticleContent,
  parseInline,
  type ArticleContentBlock,
} from "@/lib/articleContent";

function Inline({ text }: { text: string }) {
  const tokens = parseInline(text);

  return (
    <>
      {tokens.map((t, i) => {
        if (t.href) {
          return (
            <a
              key={i}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {t.text}
            </a>
          );
        }
        if (t.bold) {
          return (
            <strong key={i} className="font-bold text-foreground">
              {t.text}
            </strong>
          );
        }
        if (t.italic) {
          return (
            <em key={i} className="italic">
              {t.text}
            </em>
          );
        }
        return <Fragment key={i}>{t.text}</Fragment>;
      })}
    </>
  );
}

function Block({ block }: { block: ArticleContentBlock }) {
  switch (block.type) {
    case "heading2":
      return (
        <h2 className="font-display font-bold text-2xl md:text-3xl mt-10 mb-4 first:mt-0">
          <Inline text={block.text} />
        </h2>
      );

    case "heading3":
      return (
        <h3 className="font-display font-bold text-xl md:text-2xl mt-8 mb-3 first:mt-0">
          <Inline text={block.text} />
        </h3>
      );

    case "numberedHeading":
      return (
        <h2 className="font-display font-bold text-xl md:text-2xl mt-10 mb-4 first:mt-0 flex items-baseline gap-2">
          <span className="text-primary shrink-0">{block.number}.</span>
          <span>
            <Inline text={block.text} />
          </span>
        </h2>
      );

    case "quote":
      return (
        <blockquote className="my-8 border-l-4 border-primary bg-primary/5 rounded-r-2xl px-5 py-4 md:px-6 md:py-5 text-lg md:text-xl font-display italic text-foreground">
          <Inline text={block.text} />
        </blockquote>
      );

    case "hr":
      return <hr className="my-10 border-border" />;

    case "ul":
      return (
        <ul className="my-5 space-y-2 list-disc pl-6 marker:text-primary">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );

    case "ol":
      return (
        <ol className="my-5 space-y-2 list-decimal pl-6 marker:text-primary marker:font-semibold">
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );

    case "image":
      // object-contain + a max-height (rather than a fixed aspect ratio
      // with object-cover) so portrait/vertical photos display in full,
      // centred, instead of being cropped.
      return (
        <figure className="my-8 md:my-10">
          <div className="flex justify-center overflow-hidden rounded-2xl bg-secondary/30">
            <img
              src={block.src}
              alt={block.alt}
              loading="lazy"
              className="max-h-[70vh] w-auto max-w-full object-contain"
            />
          </div>
          {block.alt && (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {block.alt}
            </figcaption>
          )}
        </figure>
      );

    case "paragraph":
      return (
        <p className="leading-relaxed">
          <Inline text={block.text} />
        </p>
      );

    default:
      return null;
  }
}

export function ArticleRichContent({ content }: { content: string }) {
  const blocks = parseArticleContent(content);

  return (
    <div
      className="
        space-y-5
        text-base md:text-lg
        text-foreground/90
        [&_strong]:text-foreground
      "
      data-testid="article-rich-content"
    >
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}
