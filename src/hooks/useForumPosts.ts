import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ForumPost, ForumPostType, ForumComment } from '@/components/forum/types';

export function useForumPosts(subjectId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ['forum-posts', subjectId],
    queryFn: async () => {
      // Fetch posts
      const { data: postsData, error } = await supabase
        .from('subject_forum_posts')
        .select('*')
        .eq('subject_id', subjectId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!postsData || postsData.length === 0) return [];

      // Fetch user profiles for posts
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch materi data for posts with materi_id
      const materiIds = postsData.filter(p => p.materi_id).map(p => p.materi_id);
      let materiMap = new Map<string, any>();
      if (materiIds.length > 0) {
        const { data: materiData } = await supabase
          .from('materi')
          .select('id, judul, deskripsi, tipe_konten')
          .in('id', materiIds);
        materiMap = new Map(materiData?.map(m => [m.id, m]) || []);
      }

      // Fetch ujian data for posts with ujian_id
      const ujianIds = postsData.filter(p => p.ujian_id).map(p => p.ujian_id);
      let ujianMap = new Map<string, any>();
      if (ujianIds.length > 0) {
        const { data: ujianData } = await supabase
          .from('ujian')
          .select(`
            id,
            jenis,
            tanggal_pelaksanaan,
            durasi_menit,
            status,
            mapel:mapel_id (
              nama
            )
          `)
          .in('id', ujianIds);
        ujianMap = new Map(ujianData?.map(u => [u.id, u]) || []);
      }

      // Fetch comment counts
      const postIds = postsData.map(p => p.id);
      const { data: commentCounts } = await supabase
        .from('subject_forum_comments')
        .select('post_id')
        .in('post_id', postIds);

      const countMap = new Map<string, number>();
      commentCounts?.forEach(c => {
        countMap.set(c.post_id, (countMap.get(c.post_id) || 0) + 1);
      });

      return postsData.map(post => ({
        ...post,
        post_type: post.post_type as ForumPostType,
        user: profileMap.get(post.user_id),
        materi: post.materi_id ? materiMap.get(post.materi_id) : undefined,
        ujian: post.ujian_id ? ujianMap.get(post.ujian_id) : undefined,
        comments_count: countMap.get(post.id) || 0,
      })) as ForumPost[];
    },
    enabled: !!subjectId,
    staleTime: 30000,
  });

  const createPost = useMutation({
    mutationFn: async (data: {
      content: string;
      post_type: ForumPostType;
      resource_url?: string;
      materi_id?: string;
      ujian_id?: string;
      user_id: string;
    }) => {
      const { error } = await supabase
        .from('subject_forum_posts')
        .insert({
          subject_id: subjectId,
          user_id: data.user_id,
          content: data.content,
          post_type: data.post_type,
          resource_url: data.resource_url || null,
          materi_id: data.materi_id || null,
          ujian_id: data.ujian_id || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', subjectId] });
      toast({
        title: 'Berhasil',
        description: 'Postingan berhasil dibuat',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal membuat postingan',
        variant: 'destructive',
      });
    },
  });

  const updatePost = useMutation({
    mutationFn: async (data: {
      postId: string;
      is_solved?: boolean;
      is_pinned?: boolean;
      content?: string;
    }) => {
      const updateData: any = {};
      if (data.is_solved !== undefined) updateData.is_solved = data.is_solved;
      if (data.is_pinned !== undefined) updateData.is_pinned = data.is_pinned;
      if (data.content !== undefined) updateData.content = data.content;

      const { error } = await supabase
        .from('subject_forum_posts')
        .update(updateData)
        .eq('id', data.postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', subjectId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal memperbarui postingan',
        variant: 'destructive',
      });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('subject_forum_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', subjectId] });
      toast({
        title: 'Berhasil',
        description: 'Postingan berhasil dihapus',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal menghapus postingan',
        variant: 'destructive',
      });
    },
  });

  return {
    posts,
    isLoading,
    refetch,
    createPost,
    updatePost,
    deletePost,
  };
}

export function useForumComments(postId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: comments = [], isLoading, refetch } = useQuery({
    queryKey: ['forum-comments', postId],
    queryFn: async () => {
      const { data: commentsData, error } = await supabase
        .from('subject_forum_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (!commentsData || commentsData.length === 0) return [];

      // Fetch user profiles
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return commentsData.map(comment => ({
        ...comment,
        user: profileMap.get(comment.user_id),
      })) as ForumComment[];
    },
    enabled: !!postId,
    staleTime: 30000,
  });

  const createComment = useMutation({
    mutationFn: async (data: { content: string; user_id: string }) => {
      const { error } = await supabase
        .from('subject_forum_comments')
        .insert({
          post_id: postId,
          user_id: data.user_id,
          content: data.content,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', postId] });
      // Also update the post's comment count
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal menambahkan komentar',
        variant: 'destructive',
      });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('subject_forum_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['forum-posts'] });
      toast({
        title: 'Berhasil',
        description: 'Komentar berhasil dihapus',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Gagal',
        description: error.message || 'Gagal menghapus komentar',
        variant: 'destructive',
      });
    },
  });

  return {
    comments,
    isLoading,
    refetch,
    createComment,
    deleteComment,
  };
}
