import type { AnchorReport, SlideAnchor } from "@/lib/slideAnchors";
import type { StudentLevel } from "@/lib/studentLevel";
import type { IngestModelId } from "@/lib/ingestModels";
import type { PresentationAST } from "@/types/slideAst";

/**
 * Wire contract for the hybrid Notes to Slides model (POST /api/ai/ingest).
 *
 * `courseConfig` is the skeleton: which course, the locked slide anchors the screen showed,
 * and the theme. `rawNotes` is the freeform content. The server re-reads the course from
 * Firestore and resolves anchors and theme itself, so the client's copy is a display echo,
 * never the source of truth (a stale tab or a hand-crafted request can't change the skeleton).
 */
export interface HybridCourseConfig {
  courseId: string;
  anchors: SlideAnchor[];
  themeId?: string;
}

export interface HybridIngestRequest {
  courseConfig: HybridCourseConfig;
  rawNotes: string;
  model?: IngestModelId;
  targetAudience?: string;
  slideCount?: number;
  studentLevel?: StudentLevel;
  lessonTitle?: string;
  lessonSubtitle?: string;
  topics?: string;
  sources?: string;
}

export interface HybridIngestResponse {
  ast: PresentationAST;
  /** The anchors the server actually enforced, in order. */
  anchors: SlideAnchor[];
  /** What the server had to fix after the model answered (missing/misnamed/out-of-order anchors). */
  anchorReport: AnchorReport;
}
