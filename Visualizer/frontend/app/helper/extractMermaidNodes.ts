export function extractMermaidNodesWithLabels(
  mermaidCode: string
): Record<string, string> {
  const nodeRegex = /([A-Za-z0-9_]+)\s*\[([^\]]+)\]/g; // Matches ID[Label]
  const nodes: Record<string, string> = {};

  let match;
  while ((match = nodeRegex.exec(mermaidCode)) !== null) {
    const id = match[1];
    const label = match[2].trim();
    nodes[id] = label;
  }

  return nodes;
}
