import mermaid from "mermaid";

export function safeRender(code: string) {
  try {
    mermaid.parse(code);
    return true;
  } catch (e) {
    return false;
  }
}
