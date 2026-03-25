const mongoose = require("mongoose");

const ContentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true }, // AI generated notes
    metadata: { type: Object }, // extra info (model, tokens, etc.)
  },
  { timestamps: true }
);

const SubtopicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Node label from Mermaid
    content: { type: mongoose.Schema.Types.ObjectId, ref: "Content" }, // FK
  },
  { timestamps: true }
);

const LessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // Lesson name
    mermaidDiagram: { type: String, required: true }, // AI generated Mermaid.js
    subtopics: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subtopic" }],
  },
  { timestamps: true }
);

module.exports = {
  Lesson: mongoose.model("Lesson", LessonSchema),
  Subtopic: mongoose.model("Subtopic", SubtopicSchema),
  Content: mongoose.model("Content", ContentSchema),
};
