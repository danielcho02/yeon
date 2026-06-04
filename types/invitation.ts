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

export interface WeddingCardContent {
  groomName: string;
  brideName: string;
  groomFamilyDesc?: string;
  brideFamilyDesc?: string;
  date: string;
  time?: string;
  venue: string;
  venueAddress?: string;
  venueMapUrl?: string;
  greeting?: string;
  contactInfo?: string;
  accountInfo?: string;
  imageUrl?: string;
}

export interface FuneralCardContent {
  deceasedName: string;
  funeralHall: string;
  funeralHallAddress?: string;
  departureDatetime?: string;
  burialPlace?: string;
  chiefMourners?: string;
  visitingHours?: string;
  visitingInfo?: string;
  accountInfo?: string;
  imageUrl?: string;
}

export interface MobileCardData {
  id: string;
  planId: string;
  sourceReservationId?: string | null;
  ownerId: string;
  cardType: "WEDDING" | "FUNERAL";
  slug: string;
  content: WeddingCardContent | FuneralCardContent;
  isPublished: boolean;
  viewCount: number;
  shareUrl: string;
  createdAt: string;
  updatedAt: string;
}
