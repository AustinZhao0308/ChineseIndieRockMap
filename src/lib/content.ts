export type ContentType = "event" | "article" | "note";
export type ContentStatus = "draft" | "published" | "archived";

export type Post = {
  id: number;
  slug: string;
  contentType: ContentType;
  status: ContentStatus;
  title: string;
  summary: string;
  body: string;
  coverImageURL?: string;
  sourceName?: string;
  externalURL?: string;
  city?: string;
  tags: string[];
  sortOrder?: number;
  featuredEventId?: number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PostDraft = Omit<Post, "id">;
export type EventOption = { id: number; title: string; slug?: string };

export const contentTypeMeta: Record<ContentType, { label: string; description: string }> = {
  event: { label: "演出", description: "关联已有演出档案，补充现场信息。" },
  article: { label: "网页文章", description: "记录来自其他媒体与创作者的内容。" },
  note: { label: "猫啤推荐", description: "猫啤自己的聆听、现场与场景推荐。" }
};

export const emptyDraft = (contentType: ContentType = "note"): PostDraft => ({
  slug: "",
  contentType,
  status: "draft",
  title: "",
  summary: "",
  body: "",
  coverImageURL: "",
  sourceName: contentType === "note" ? "Catbeer 编辑部" : "",
  externalURL: "",
  city: "",
  tags: [],
  sortOrder: 0,
  featuredEventId: null,
  publishedAt: null,
  createdAt: null,
  updatedAt: null
});

export const tokenHeaders = () => {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const postStatus = (post: Post) => {
  if (post.status === "archived") return "archived" as const;
  if (post.status === "published" && post.publishedAt && new Date(post.publishedAt).getTime() > Date.now()) return "scheduled" as const;
  return post.status;
};

export const statusMeta = {
  draft: { label: "草稿", className: "text-white/48 border-white/12 bg-white/[0.035]" },
  published: { label: "已发布", className: "text-[#b8e5c2] border-[#4f9b62]/35 bg-[#4f9b62]/10" },
  scheduled: { label: "定时发布", className: "text-[#ffd08a] border-[#b67a20]/35 bg-[#b67a20]/10" },
  archived: { label: "已归档", className: "text-white/42 border-white/10 bg-black/15" }
};

export const formatPostDate = (value?: string | null, withTime = false) => {
  if (!value) return "未发布";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {})
  }).format(date);
};

export const dateTimeInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const serializeDraft = (draft: PostDraft) => ({
  ...draft,
  tags: draft.tags.map(tag => tag.trim()).filter(Boolean),
  publishedAt: draft.publishedAt || null
});
