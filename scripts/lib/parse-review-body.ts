import type { AgentReviewInput } from "./agent-review.js";

export function parseReviewBody(body: unknown): AgentReviewInput | { error: string } {
  const b = body as Record<string, unknown>;
  const slideId = typeof b.slideId === "string" ? b.slideId : "";
  if (!slideId) return { error: "Missing slideId." };

  const commentsRaw = Array.isArray(b.comments) ? b.comments : null;
  const commentText = typeof b.commentText === "string" ? b.commentText.trim() : "";

  let comments: AgentReviewInput["comments"];
  if (commentsRaw && commentsRaw.length > 0) {
    comments = commentsRaw
      .map((item) => {
        const row = item as Record<string, unknown>;
        const text = typeof row.body === "string" ? row.body.trim() : "";
        if (!text) return null;
        return {
          id: typeof row.id === "string" ? row.id : undefined,
          field: typeof row.field === "string" ? row.field : undefined,
          body: text,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  } else if (commentText) {
    comments = [
      {
        body: commentText,
        field: typeof (b.context as Record<string, unknown> | undefined)?.field === "string"
          ? ((b.context as Record<string, unknown>).field as string)
          : undefined,
      },
    ];
  } else {
    return { error: "Missing comments or commentText." };
  }

  if (comments.length === 0) return { error: "No comment bodies to apply." };

  const context =
    b.context && typeof b.context === "object"
      ? (b.context as AgentReviewInput["context"])
      : undefined;
  const targetElement =
    typeof b.targetElement === "string"
      ? b.targetElement
      : typeof context?.targetElement === "string"
        ? context.targetElement
        : undefined;

  return { slideId, comments, targetElement, context };
}
