import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import type {
  AiModelDto,
  AiStatusDto,
  AiTestResult,
  AiUsageEntryDto,
  AppSettings,
  BootstrapDto,
  CharacterDetail,
  CharacterInput,
  CharacterSummary,
  ChatDetail,
  ChatSummary,
  CommentDto,
  DeepPartial,
  DiscoverDto,
  EventCard,
  FeedPage,
  GroupDto,
  MemoryEntryDto,
  NotificationDto,
  PostDetailDto,
  PostDto,
  ProgressDelta,
  ProgressDto,
  RelationshipDto,
  SendMessageResult,
  SimulationResult,
  SimulationStatusDto,
  StoryDto,
  StorylineDto,
  TrendingTag,
  TriggerEventInput,
  UserProfileDto,
  WorldDetail,
  WorldDraft,
  WorldEventDto,
  WorldInput,
  WorldSummary,
} from '../../../shared/types';
import { del, get, patch, post, put, qs } from './client';

export const keys = {
  bootstrap: ['bootstrap'] as const,
  discover: ['discover'] as const,
  feed: (filters: FeedFilters) => ['feed', filters] as const,
  feedAll: ['feed'] as const,
  post: (id: string) => ['post', id] as const,
  stories: ['stories'] as const,
  trending: ['trending'] as const,
  characters: (filters: { world?: string; custom?: boolean } = {}) => ['characters', filters] as const,
  charactersAll: ['characters'] as const,
  character: (id: string) => ['character', id] as const,
  chats: ['chats'] as const,
  chat: (id: string) => ['chat', id] as const,
  worlds: ['worlds'] as const,
  world: (id: string) => ['world', id] as const,
  events: (id: string) => ['events', id] as const,
  eventCards: ['event-cards'] as const,
  progress: ['progress'] as const,
  notifications: ['notifications'] as const,
  aiStatus: ['ai-status'] as const,
  aiModels: ['ai-models'] as const,
  aiUsage: ['ai-usage'] as const,
  simStatus: ['simulation-status'] as const,
};

export interface FeedFilters {
  world?: string;
  character?: string;
  tag?: string;
  author?: 'user';
  bookmarked?: boolean;
}

// ---------- Basis ----------

export function useBootstrap() {
  return useQuery({
    queryKey: keys.bootstrap,
    queryFn: ({ signal }) => get<BootstrapDto>('/bootstrap', signal),
    refetchInterval: 20_000,
  });
}

export function useDiscover() {
  return useQuery({ queryKey: keys.discover, queryFn: ({ signal }) => get<DiscoverDto>('/discover', signal) });
}

export function useProgress() {
  return useQuery({ queryKey: keys.progress, queryFn: ({ signal }) => get<ProgressDto>('/progress', signal) });
}

export function useNotifications() {
  return useQuery({
    queryKey: keys.notifications,
    queryFn: ({ signal }) => get<{ items: NotificationDto[]; unread: number }>('/notifications', signal),
  });
}

/** Nach Aktionen mit Fortschritt: XP, Level und Quests neu laden. */
export function invalidateProgress(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: keys.progress });
  void qc.invalidateQueries({ queryKey: keys.bootstrap });
}

// ---------- Feed ----------

export function useFeed(filters: FeedFilters) {
  return useInfiniteQuery({
    queryKey: keys.feed(filters),
    queryFn: ({ pageParam, signal }) =>
      get<FeedPage>(
        `/posts${qs({
          world: filters.world,
          character: filters.character,
          tag: filters.tag,
          author: filters.author,
          bookmarked: filters.bookmarked,
          cursor: pageParam,
        })}`,
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000,
  });
}

export function usePostDetail(id: string) {
  return useQuery({ queryKey: keys.post(id), queryFn: ({ signal }) => get<PostDetailDto>(`/posts/${id}`, signal) });
}

export function useTrending() {
  return useQuery({ queryKey: keys.trending, queryFn: ({ signal }) => get<TrendingTag[]>('/tags/trending', signal) });
}

/** Aktualisiert einen Beitrag in allen zwischengespeicherten Listen, ohne neu zu laden. */
export function updatePostInCache(qc: QueryClient, updated: PostDto) {
  const replace = (p: PostDto): PostDto => {
    if (p.id === updated.id) return { ...updated, repostOf: updated.repostOf ?? p.repostOf };
    if (p.repostOf?.id === updated.id) return { ...p, repostOf: { ...updated, repostOf: null } };
    return p;
  };
  qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: keys.feedAll }, (data) =>
    data ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map(replace) })) } : data,
  );
  qc.setQueryData<PostDetailDto>(keys.post(updated.id), (data) => (data ? { ...data, post: replace(data.post) } : data));
  qc.setQueryData<DiscoverDto>(keys.discover, (data) =>
    data ? { ...data, highlightPosts: data.highlightPosts.map(replace) } : data,
  );
}

function removePostFromCache(qc: QueryClient, id: string) {
  qc.setQueriesData<InfiniteData<FeedPage>>({ queryKey: keys.feedAll }, (data) =>
    data
      ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((p) => p.id !== id) })) }
      : data,
  );
}

type WithProgress<T> = T & { progress: ProgressDelta };

export function usePostActions() {
  const qc = useQueryClient();
  const onPost = (res: WithProgress<{ post: PostDto }>) => {
    updatePostInCache(qc, res.post);
    invalidateProgress(qc);
    return res;
  };
  return {
    like: useMutation({
      mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
        liked ? put<WithProgress<{ post: PostDto }>>(`/posts/${id}/like`) : del<WithProgress<{ post: PostDto }>>(`/posts/${id}/like`),
      onSuccess: onPost,
    }),
    bookmark: useMutation({
      mutationFn: ({ id, saved }: { id: string; saved: boolean }) =>
        saved
          ? put<WithProgress<{ post: PostDto }>>(`/posts/${id}/bookmark`)
          : del<WithProgress<{ post: PostDto }>>(`/posts/${id}/bookmark`),
      onSuccess: (res) => {
        onPost(res);
        void qc.invalidateQueries({ queryKey: keys.feed({ bookmarked: true }) });
      },
    }),
    repost: useMutation({
      mutationFn: ({ id, content }: { id: string; content?: string }) =>
        post<WithProgress<{ post: PostDto }>>(`/posts/${id}/repost`, { content }),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: keys.feedAll });
        void qc.invalidateQueries({ queryKey: ['post'] });
        invalidateProgress(qc);
      },
    }),
    undoRepost: useMutation({
      mutationFn: (id: string) => del<void>(`/posts/${id}/repost`),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: keys.feedAll });
        void qc.invalidateQueries({ queryKey: ['post'] });
      },
    }),
    update: useMutation({
      mutationFn: ({ id, content }: { id: string; content: string }) => patch<PostDto>(`/posts/${id}`, { content }),
      onSuccess: (p) => updatePostInCache(qc, p),
    }),
    remove: useMutation({
      mutationFn: (id: string) => del<void>(`/posts/${id}`),
      onSuccess: (_r, id) => {
        removePostFromCache(qc, id);
        void qc.invalidateQueries({ queryKey: keys.feedAll });
        void qc.invalidateQueries({ queryKey: keys.discover });
      },
    }),
  };
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; worldId: string | null }) => post<WithProgress<{ post: PostDto }>>('/posts', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.feedAll });
      void qc.invalidateQueries({ queryKey: keys.trending });
      invalidateProgress(qc);
    },
  });
}

export function useCommentActions(postId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.post(postId) });
    void qc.invalidateQueries({ queryKey: keys.feedAll });
  };
  return {
    add: useMutation({
      mutationFn: (input: { content: string; parentId: string | null }) =>
        post<WithProgress<{ comment: CommentDto }>>(`/posts/${postId}/comments`, input),
      onSuccess: () => {
        refresh();
        invalidateProgress(qc);
      },
    }),
    remove: useMutation({ mutationFn: (id: string) => del<void>(`/comments/${id}`), onSuccess: refresh }),
  };
}

// ---------- Stories ----------

export function useStories() {
  return useQuery({ queryKey: keys.stories, queryFn: ({ signal }) => get<StoryDto[]>('/stories', signal), refetchInterval: 60_000 });
}

export function useStoryActions() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: keys.stories });
  return {
    create: useMutation({
      mutationFn: (input: { content: string; style: number }) => post<WithProgress<{ story: StoryDto }>>('/stories', input),
      onSuccess: () => {
        refresh();
        invalidateProgress(qc);
      },
    }),
    view: useMutation({
      mutationFn: (id: string) => post<{ ok: true }>(`/stories/${id}/view`),
      onSuccess: (_r, id) =>
        qc.setQueryData<StoryDto[]>(keys.stories, (list) => list?.map((s) => (s.id === id ? { ...s, seen: true } : s))),
    }),
    remove: useMutation({ mutationFn: (id: string) => del<void>(`/stories/${id}`), onSuccess: refresh }),
  };
}

// ---------- Charaktere & Chats ----------

export function useCharacters(filters: { world?: string; custom?: boolean } = {}) {
  return useQuery({
    queryKey: keys.characters(filters),
    queryFn: ({ signal }) => get<CharacterSummary[]>(`/characters${qs({ world: filters.world, custom: filters.custom })}`, signal),
  });
}

export function useCharacter(id: string, visit = false) {
  return useQuery({
    queryKey: keys.character(id),
    queryFn: ({ signal }) =>
      get<{ character: CharacterDetail; progress: ProgressDelta }>(`/characters/${id}${qs({ visit })}`, signal),
    enabled: Boolean(id),
  });
}

export function useCharacterMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.charactersAll });
    void qc.invalidateQueries({ queryKey: keys.worlds });
    void qc.invalidateQueries({ queryKey: ['world'] });
    void qc.invalidateQueries({ queryKey: keys.discover });
  };
  return {
    create: useMutation({
      mutationFn: (input: CharacterInput) => post<WithProgress<{ character: CharacterDetail }>>('/characters', input),
      onSuccess: () => {
        refresh();
        invalidateProgress(qc);
      },
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: CharacterInput }) => put<CharacterDetail>(`/characters/${id}`, input),
      onSuccess: (c) => {
        refresh();
        void qc.invalidateQueries({ queryKey: keys.character(c.id) });
      },
    }),
    remove: useMutation({
      mutationFn: (id: string) => del<void>(`/characters/${id}`),
      onSuccess: () => {
        refresh();
        void qc.invalidateQueries({ queryKey: keys.chats });
        void qc.invalidateQueries({ queryKey: keys.feedAll });
      },
    }),
  };
}

export function useChats() {
  return useQuery({ queryKey: keys.chats, queryFn: ({ signal }) => get<ChatSummary[]>('/chats', signal) });
}

export function useChat(characterId: string) {
  return useQuery({
    queryKey: keys.chat(characterId),
    queryFn: ({ signal }) => get<ChatDetail>(`/chats/${characterId}`, signal),
    enabled: Boolean(characterId),
  });
}

export function useChatActions(characterId: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.chat(characterId) });
    void qc.invalidateQueries({ queryKey: keys.chats });
  };
  return {
    send: useMutation({
      mutationFn: (content: string) => post<SendMessageResult>(`/chats/${characterId}/messages`, { content }),
      onSuccess: () => {
        refresh();
        invalidateProgress(qc);
        void qc.invalidateQueries({ queryKey: keys.aiStatus });
      },
    }),
    settings: useMutation({
      mutationFn: (input: { memoryEnabled?: boolean; memoryWindow?: number }) =>
        patch<ChatDetail>(`/chats/${characterId}`, input),
      onSuccess: (data) => qc.setQueryData(keys.chat(characterId), data),
    }),
    addMemory: useMutation({
      mutationFn: (content: string) => post<MemoryEntryDto[]>(`/chats/${characterId}/memories`, { content }),
      onSuccess: refresh,
    }),
    removeMemory: useMutation({
      mutationFn: (id: string) => del<MemoryEntryDto[]>(`/chats/${characterId}/memories/${id}`),
      onSuccess: refresh,
    }),
    clear: useMutation({ mutationFn: () => del<void>(`/chats/${characterId}`), onSuccess: refresh }),
  };
}

export function usePromptPreview(characterId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['prompt-preview', characterId],
    queryFn: ({ signal }) =>
      get<{ messages: { role: string; content: string }[]; model: string | null; mode: 'ai' | 'demo' }>(
        `/chats/${characterId}/prompt-preview`,
        signal,
      ),
    enabled,
    staleTime: 0,
  });
}

// ---------- Welten ----------

export function useWorlds() {
  return useQuery({ queryKey: keys.worlds, queryFn: ({ signal }) => get<WorldSummary[]>('/worlds', signal) });
}

export function useWorld(id: string, visit = false) {
  return useQuery({
    queryKey: keys.world(id),
    queryFn: ({ signal }) => get<{ world: WorldDetail; progress: ProgressDelta }>(`/worlds/${id}${qs({ visit })}`, signal),
    enabled: Boolean(id),
  });
}

export function useWorldEvents(id: string) {
  return useInfiniteQuery({
    queryKey: keys.events(id),
    queryFn: ({ pageParam, signal }) => get<WorldEventDto[]>(`/worlds/${id}/events${qs({ before: pageParam })}`, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length >= 30 ? last[last.length - 1].createdAt : undefined),
  });
}

export function useEventCards() {
  return useQuery({ queryKey: keys.eventCards, queryFn: ({ signal }) => get<EventCard[]>('/event-cards', signal), staleTime: Infinity });
}

function refreshWorld(qc: QueryClient, id: string) {
  void qc.invalidateQueries({ queryKey: keys.world(id) });
  void qc.invalidateQueries({ queryKey: keys.events(id) });
  void qc.invalidateQueries({ queryKey: keys.worlds });
  void qc.invalidateQueries({ queryKey: keys.discover });
  void qc.invalidateQueries({ queryKey: keys.feedAll });
  void qc.invalidateQueries({ queryKey: keys.stories });
  void qc.invalidateQueries({ queryKey: keys.charactersAll });
  void qc.invalidateQueries({ queryKey: ['character'] });
}

export function useWorldActions(id: string) {
  const qc = useQueryClient();
  return {
    simulate: useMutation({
      mutationFn: () => post<WithProgress<SimulationResult>>(`/worlds/${id}/simulate`),
      onSuccess: () => {
        refreshWorld(qc, id);
        invalidateProgress(qc);
        void qc.invalidateQueries({ queryKey: keys.simStatus });
      },
    }),
    trigger: useMutation({
      mutationFn: (input: TriggerEventInput) => post<WithProgress<SimulationResult>>(`/worlds/${id}/events`, input),
      onSuccess: () => {
        refreshWorld(qc, id);
        invalidateProgress(qc);
      },
    }),
    update: useMutation({
      mutationFn: (input: WorldInput) => put<WorldDetail>(`/worlds/${id}`, input),
      onSuccess: () => refreshWorld(qc, id),
    }),
    remove: useMutation({
      mutationFn: () => del<void>(`/worlds/${id}`),
      onSuccess: () => {
        qc.removeQueries({ queryKey: keys.world(id) });
        refreshWorld(qc, id);
      },
    }),
    addRelationship: useMutation({
      mutationFn: (input: { aId: string; bId: string; kind: string; affinity: number; note: string }) =>
        post<RelationshipDto>(`/worlds/${id}/relationships`, input),
      onSuccess: () => refreshWorld(qc, id),
    }),
    updateRelationship: useMutation({
      mutationFn: ({ relId, ...input }: { relId: string; kind?: string; affinity?: number; note?: string }) =>
        patch<RelationshipDto>(`/relationships/${relId}`, input),
      onSuccess: () => refreshWorld(qc, id),
    }),
    removeRelationship: useMutation({
      mutationFn: (relId: string) => del<void>(`/relationships/${relId}`),
      onSuccess: () => refreshWorld(qc, id),
    }),
    addGroup: useMutation({
      mutationFn: (input: { name: string; description: string; hue: number; memberIds: string[] }) =>
        post<GroupDto>(`/worlds/${id}/groups`, input),
      onSuccess: () => refreshWorld(qc, id),
    }),
    addStoryline: useMutation({
      mutationFn: (input: { title: string; summary: string; stages: string[]; theme: 'harmony' | 'tension' | 'discovery' }) =>
        post<StorylineDto>(`/worlds/${id}/storylines`, input),
      onSuccess: () => refreshWorld(qc, id),
    }),
    removeGroup: useMutation({
      mutationFn: (groupId: string) => del<void>(`/groups/${groupId}`),
      onSuccess: () => refreshWorld(qc, id),
    }),
    setMember: useMutation({
      mutationFn: ({ groupId, characterId, role }: { groupId: string; characterId: string; role: string }) =>
        put<GroupDto>(`/groups/${groupId}/members/${characterId}`, { role }),
      onSuccess: () => refreshWorld(qc, id),
    }),
    removeMember: useMutation({
      mutationFn: ({ groupId, characterId }: { groupId: string; characterId: string }) =>
        del<void>(`/groups/${groupId}/members/${characterId}`),
      onSuccess: () => refreshWorld(qc, id),
    }),
  };
}

export function useWorldGenerator() {
  const qc = useQueryClient();
  return {
    generate: useMutation({
      mutationFn: (input: { genre: string; prompt: string; characterCount: number; useAi: boolean }) =>
        post<WorldDraft>('/worlds/generate', input),
      onSuccess: () => void qc.invalidateQueries({ queryKey: keys.aiStatus }),
    }),
    create: useMutation({
      mutationFn: (input: { world: WorldInput; characters: Omit<CharacterInput, 'worldId'>[] }) =>
        post<WithProgress<{ world: WorldDetail }>>('/worlds', input),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: keys.worlds });
        void qc.invalidateQueries({ queryKey: keys.charactersAll });
        void qc.invalidateQueries({ queryKey: keys.discover });
        invalidateProgress(qc);
      },
    }),
  };
}

// ---------- Fortschritt, Profil, Einstellungen ----------

export function useClaimQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<{ progress: ProgressDelta; summary: ProgressDto }>(`/quests/${id}/claim`),
    onSuccess: (res) => {
      qc.setQueryData(keys.progress, res.summary);
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<UserProfileDto>) => patch<UserProfileDto>('/profile', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      void qc.invalidateQueries({ queryKey: keys.feedAll });
      void qc.invalidateQueries({ queryKey: ['post'] });
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DeepPartial<AppSettings>) => patch<AppSettings>('/settings', input),
    onSuccess: (settings) => {
      qc.setQueryData<BootstrapDto>(keys.bootstrap, (b) => (b ? { ...b, settings } : b));
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
      void qc.invalidateQueries({ queryKey: keys.aiStatus });
      void qc.invalidateQueries({ queryKey: keys.simStatus });
    },
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => post<{ ok: true }>('/notifications/read-all'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.notifications });
      void qc.invalidateQueries({ queryKey: keys.bootstrap });
    },
  });
}

export function useResetData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { language?: 'de' | 'en' }) => post<{ ok: true }>('/data/reset', { confirm: 'RESET', ...input }),
    // Alte Daten bleiben bis zum Neuladen sichtbar, damit offene Dialoge (z. B. Onboarding) erhalten bleiben.
    onSuccess: () => void qc.invalidateQueries(),
  });
}

// ---------- KI ----------

export function useAiStatus() {
  return useQuery({ queryKey: keys.aiStatus, queryFn: ({ signal }) => get<AiStatusDto>('/ai/status', signal) });
}

export function useAiModels(enabled: boolean) {
  return useQuery({
    queryKey: keys.aiModels,
    queryFn: ({ signal }) => get<AiModelDto[]>('/ai/models', signal),
    enabled,
    staleTime: 30 * 60_000,
    retry: false,
  });
}

export function useAiUsage() {
  return useQuery({
    queryKey: keys.aiUsage,
    queryFn: ({ signal }) => get<{ status: AiStatusDto; entries: AiUsageEntryDto[] }>('/ai/usage', signal),
  });
}

export function useAiActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.aiStatus });
    void qc.invalidateQueries({ queryKey: keys.bootstrap });
    void qc.invalidateQueries({ queryKey: keys.aiUsage });
  };
  return {
    saveKey: useMutation({ mutationFn: (key: string) => put<AiStatusDto>('/ai/key', { key }), onSuccess: refresh }),
    removeKey: useMutation({ mutationFn: () => del<AiStatusDto>('/ai/key'), onSuccess: refresh }),
    test: useMutation({ mutationFn: () => post<AiTestResult>('/ai/test'), onSuccess: refresh }),
  };
}

export function useSimulationStatus() {
  return useQuery({
    queryKey: keys.simStatus,
    queryFn: ({ signal }) => get<SimulationStatusDto>('/simulation/status', signal),
    refetchInterval: 60_000,
  });
}
