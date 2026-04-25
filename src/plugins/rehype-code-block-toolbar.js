function toClassList(node) {
  const className = node?.properties?.className;
  if (Array.isArray(className)) {
    return className.map(String);
  }
  if (typeof className === "string") {
    return className.split(/\s+/).filter(Boolean);
  }
  return [];
}

function getLanguage(node) {
  const properties = node?.properties ?? {};
  const language =
    properties.dataLanguage ??
    properties["data-language"] ??
    properties.language;

  if (typeof language === "string" && language.length > 0) {
    return language;
  }
  const codeChild = (node?.children ?? []).find(
    (child) => child?.type === "element" && child.tagName === "code",
  );
  const classList = toClassList(codeChild);
  const languageClass = classList.find((name) => name.startsWith("language-"));
  if (languageClass) {
    return languageClass.slice("language-".length) || "text";
  }

  return "text";
}

function isCodePre(node) {
  if (!(node?.type === "element" && node.tagName === "pre")) {
    return false;
  }

  const children = node.children ?? [];
  return children.some(
    (child) => child?.type === "element" && child.tagName === "code",
  );
}

function buildToolbarWrapper(preNode) {
  const language = getLanguage(preNode);

  return {
    type: "element",
    tagName: "div",
    properties: { className: ["code-block"] },
    children: [
      {
        type: "element",
        tagName: "div",
        properties: { className: ["code-block-toolbar"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["code-block-meta"] },
            children: [
              {
                type: "element",
                tagName: "span",
                properties: { className: ["code-language"] },
                children: [{ type: "text", value: language }],
              },
            ],
          },
          {
            type: "element",
            tagName: "div",
            properties: { className: ["code-block-actions"] },
            children: [
              {
                type: "element",
                tagName: "button",
                properties: {
                  className: ["code-action"],
                  type: "button",
                  "data-code-wrap-toggle": "",
                  "aria-pressed": "false",
                },
                children: [{ type: "text", value: "wrap" }],
              },
              {
                type: "element",
                tagName: "button",
                properties: {
                  className: ["code-action"],
                  type: "button",
                  "data-code-copy": "",
                },
                children: [{ type: "text", value: "copy" }],
              },
            ],
          },
        ],
      },
      preNode,
    ],
  };
}

function wrapCodeBlocks(node) {
  if (!node || !Array.isArray(node.children)) return;

  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index];

    if (isCodePre(child)) {
      node.children[index] = buildToolbarWrapper(child);
      continue;
    }

    if (child && typeof child === "object" && Array.isArray(child.children)) {
      wrapCodeBlocks(child);
    }
  }
}

export default function rehypeCodeBlockToolbar() {
  return function transformer(tree) {
    wrapCodeBlocks(tree);
  };
}
