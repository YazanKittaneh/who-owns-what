import React, { ReactNode } from "react";

type RichTextNode = {
  nodeType: string;
  value?: string;
  marks?: Array<{ type: string }>;
  data?: Record<string, unknown>;
  content?: RichTextNode[];
};

type Props = {
  node: RichTextNode;
};

function applyMarks(text: string, marks: Array<{ type: string }> = []): ReactNode {
  return marks.reduce<ReactNode>((acc, mark, index) => {
    const key = `${mark.type}-${index}`;
    if (mark.type === "bold") return <strong key={key}>{acc}</strong>;
    if (mark.type === "italic") return <em key={key}>{acc}</em>;
    if (mark.type === "underline") return <u key={key}>{acc}</u>;
    return acc;
  }, text);
}

function getTextContent(nodes: RichTextNode[] = []): string {
  return nodes
    .flatMap((node) => {
      if (node.nodeType === "text") return [node.value ?? ""];
      return [getTextContent(node.content ?? [])];
    })
    .join("");
}

function renderChildren(nodes: RichTextNode[] = []): ReactNode[] {
  return nodes.map((child, index) => <ContentfulRichText key={`${child.nodeType}-${index}`} node={child} />);
}

export default function ContentfulRichText({ node }: Props): ReactNode {
  switch (node.nodeType) {
    case "document":
      return <>{renderChildren(node.content)}</>;
    case "paragraph":
      return <p>{renderChildren(node.content)}</p>;
    case "heading-1":
      return <h1>{renderChildren(node.content)}</h1>;
    case "heading-2":
      return <h2>{renderChildren(node.content)}</h2>;
    case "heading-3":
      return <h3>{renderChildren(node.content)}</h3>;
    case "heading-4":
      return <h4>{renderChildren(node.content)}</h4>;
    case "heading-5":
      return <h5>{renderChildren(node.content)}</h5>;
    case "heading-6":
      return <h6>{renderChildren(node.content)}</h6>;
    case "unordered-list":
      return <ul>{renderChildren(node.content)}</ul>;
    case "ordered-list":
      return <ol>{renderChildren(node.content)}</ol>;
    case "list-item":
      return <li>{renderChildren(node.content)}</li>;
    case "hr":
      return <hr />;
    case "hyperlink": {
      const uri = typeof node.data?.uri === "string" ? node.data.uri : "#";
      return (
        <a href={uri} target={uri.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          {renderChildren(node.content)}
        </a>
      );
    }
    case "embedded-asset-block": {
      const target = node.data?.target as { fields?: { title?: string; file?: { url?: string } } } | undefined;
      const src = target?.fields?.file?.url;
      const title = target?.fields?.title ?? "Embedded asset";
      if (!src) return <p>{title}</p>;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src.startsWith("//") ? `https:${src}` : src} alt={title} style={{ maxWidth: "100%" }} />
      );
    }
    case "text":
      return <>{applyMarks(node.value ?? "", node.marks)}</>;
    default:
      return <>{getTextContent(node.content)}</>;
  }
}
