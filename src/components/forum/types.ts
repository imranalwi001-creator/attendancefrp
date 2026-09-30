export type ForumPostType = 'announcement' | 'qna' | 'resource';

export interface ForumPost {
  id: string;
  subject_id: string;
  user_id: string;
  content: string;
  post_type: ForumPostType;
  is_pinned: boolean;
  is_solved: boolean;
  resource_url: string | null;
  materi_id: string | null;
  ujian_id: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  materi?: {
    id: string;
    judul: string;
    deskripsi?: string;
    tipe_konten: string;
  };
  ujian?: {
    id: string;
    jenis: string;
    tanggal_pelaksanaan: string;
    durasi_menit: number | null;
    status: string;
    mapel?: {
      nama: string;
    };
  };
  comments_count?: number;
}

export interface ForumComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}

export interface ForumComposerProps {
  subjectId: string;
  userRole: string;
  onPostCreated: () => void;
}

export interface ForumPostCardProps {
  post: ForumPost;
  userRole: string;
  currentUserId: string;
  onPostUpdated: () => void;
}

export interface ForumCommentSectionProps {
  postId: string;
  isExpanded: boolean;
  currentUserId: string;
}
