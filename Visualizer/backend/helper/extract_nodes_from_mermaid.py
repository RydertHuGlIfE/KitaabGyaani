import re

__all__ = ["extract_nodes_from_mermaid"]

def extract_nodes_from_mermaid(mermaid_code):
    """
    Extract nodes from mermaid code.
    
    Args:
        mermaid_code (str): The mermaid code to parse
        
    Returns:
        dict: A dictionary mapping node IDs to their labels
    """
    
    node_regex = r"([A-Za-z0-9_]+)\s*\[([^\]]+)\]"
    nodes = []
    
    for match in re.finditer(node_regex, mermaid_code):
        node_id = match.group(1)
        label = match.group(2).strip()
        nodes.append({"id": node_id, "label": label})
    
    return nodes
