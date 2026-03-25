// app/prompt-lesson/page.tsx
import { Suspense } from "react";
import PromptLesson from "../components/PromptLesson";

export default function PromptLessonPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PromptLesson />
    </Suspense>
  );
}
