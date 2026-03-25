import React from "react";
import ReactMarkdown from "react-markdown";

function RenderContent({ subtopicContent }: { subtopicContent: string }) {
  return (
    <div className="prose max-h-[60vh] max-w-none overflow-y-auto space-y-3 leading-relaxed no-scrollbar">
      <ReactMarkdown>{subtopicContent}</ReactMarkdown>
    </div>
  );
}

export default RenderContent;
