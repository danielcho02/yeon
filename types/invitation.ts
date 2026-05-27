export interface InvitationData {
  id: string;
  planId: string;
  templateId: string;
  shareUrl: string;
  content: Record<string, unknown>;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
