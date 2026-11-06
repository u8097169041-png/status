/** Datenzugriff für Lebensgeschichten, Bild-KI und Aussehen von Figuren. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Appearance } from '../../../shared/appearance';
import type { LifeCharacterDto, LifeMemoryDto, LifeSetupDraft, LifeSetupJobDto, LifeStoryDto, LifeStorySummaryDto } from '../../../shared/life';
import type { CharacterAppearanceDto, ChatImageResult, ImageJobDto, ImageStatusDto } from '../../../shared/types';
import { del, get, post, put, qs } from './client';
import { keys } from './hooks';

export const lifeKeys = {
  stories: ['life', 'stories'] as const,
  story: (id: string) => ['life', 'story', id] as const,
  memories: (id: string, q: string) => ['life', 'memories', id, q] as const,
  setupJob: (id: string | null) => ['life', 'setup-job', id] as const,
  imageStatus: ['images', 'status'] as const,
  imageJob: (id: string | null) => ['images', 'job', id] as const,
  appearance: (id: string) => ['appearance', id] as const,
};

// ---------- Bild-KI ----------

export function useImageStatus(refresh = false) {
  return useQuery({
    queryKey: [...lifeKeys.imageStatus, refresh],
    queryFn: ({ signal }) => get<ImageStatusDto>(`/images/status${qs({ refresh })}`, signal),
    staleTime: 20_000,
  });
}

/** Fragt einen Bildauftrag ab, bis er fertig ist (alle 1,5 s, kein Dauerabruf danach). */
export function useImageJob(jobId: string | null, onFinished?: (job: ImageJobDto) => void) {
  return useQuery({
    queryKey: lifeKeys.imageJob(jobId),
    queryFn: async ({ signal }) => {
      const job = await get<ImageJobDto>(`/images/jobs/${jobId}`, signal);
      if (job.status !== 'queued' && job.status !== 'running') onFinished?.(job);
      return job;
    },
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data && query.state.data.status !== 'queued' && query.state.data.status !== 'running' ? false : 1_500),
    staleTime: 0,
    gcTime: 60_000,
  });
}

export function useCancelImageJob() {
  return useMutation({ mutationFn: (id: string) => del<ImageJobDto>(`/images/jobs/${id}`) });
}

export function useChatImage(characterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (description: string) => post<ChatImageResult>(`/chats/${characterId}/images`, { description }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.chat(characterId) }),
  });
}

// ---------- Aussehen und Profilfoto ----------

export function useCharacterAppearance(id: string) {
  return useQuery({
    queryKey: lifeKeys.appearance(id),
    queryFn: ({ signal }) => get<CharacterAppearanceDto>(`/characters/${id}/appearance`, signal),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.pendingJob ? 2_000 : false),
  });
}

export function useAppearanceActions(id: string) {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: lifeKeys.appearance(id) });
    void qc.invalidateQueries({ queryKey: keys.character(id) });
    void qc.invalidateQueries({ queryKey: keys.charactersAll });
    void qc.invalidateQueries({ queryKey: keys.chatsAll });
    void qc.invalidateQueries({ queryKey: keys.chat(id) });
  };
  return {
    save: useMutation({ mutationFn: (appearance: Appearance) => put<CharacterAppearanceDto>(`/characters/${id}/appearance`, appearance), onSuccess: refresh }),
    generate: useMutation({ mutationFn: () => post<ImageJobDto>(`/characters/${id}/avatar`), onSuccess: refresh }),
    removePhoto: useMutation({ mutationFn: () => del<CharacterAppearanceDto>(`/characters/${id}/avatar`), onSuccess: refresh }),
    refresh,
  };
}

// ---------- Lebensgeschichten ----------

export function useLifeStories() {
  return useQuery({ queryKey: lifeKeys.stories, queryFn: ({ signal }) => get<LifeStorySummaryDto[]>('/life/stories', signal) });
}

/** Geschichte mit Verlauf. Während erzählt oder ein Bild erzeugt wird, wird regelmäßig nachgeladen. */
export function useLifeStory(id: string) {
  return useQuery({
    queryKey: lifeKeys.story(id),
    queryFn: ({ signal }) => get<LifeStoryDto>(`/life/stories/${id}`, signal),
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.narrating ? 1_200 : query.state.data?.imageJob ? 2_000 : false),
  });
}

export function useLifeOlderMessages(id: string) {
  return useMutation({ mutationFn: (before: number) => get<LifeStoryDto>(`/life/stories/${id}${qs({ before })}`) });
}

export function useLifeMemories(id: string, q: string, enabled: boolean) {
  return useQuery({
    queryKey: lifeKeys.memories(id, q),
    queryFn: ({ signal }) => get<LifeMemoryDto[]>(`/life/stories/${id}/memories${qs({ q })}`, signal),
    enabled,
  });
}

export function useLifeActions(id: string) {
  const qc = useQueryClient();
  const apply = (story: LifeStoryDto) => {
    qc.setQueryData(lifeKeys.story(id), story);
    void qc.invalidateQueries({ queryKey: lifeKeys.stories });
    void qc.invalidateQueries({ queryKey: ['life', 'memories', id] });
  };
  return {
    turn: useMutation({ mutationFn: (input: { text?: string; suggestionId?: string }) => post<LifeStoryDto>(`/life/stories/${id}/turns`, input), onSuccess: apply }),
    advance: useMutation({ mutationFn: () => post<LifeStoryDto>(`/life/stories/${id}/advance`), onSuccess: apply }),
    image: useMutation({
      mutationFn: (description: string) => post<{ job: ImageJobDto | null; story: LifeStoryDto }>(`/life/stories/${id}/images`, { description }),
      onSuccess: (r) => apply(r.story),
    }),
    avatar: useMutation({
      mutationFn: (characterId: string) => post<{ job: ImageJobDto; character: LifeCharacterDto }>(`/life/characters/${characterId}/avatar`),
      onSuccess: () => void qc.invalidateQueries({ queryKey: lifeKeys.story(id) }),
    }),
    remove: useMutation({
      mutationFn: () => del<void>(`/life/stories/${id}`),
      onSuccess: () => {
        qc.removeQueries({ queryKey: lifeKeys.story(id) });
        void qc.invalidateQueries({ queryKey: lifeKeys.stories });
      },
    }),
  };
}

export interface LifeSetupInput {
  prompt: string;
  parts?: { background?: string; characters?: string; relationships?: string; start?: string; details?: string };
  playerName?: string;
  socialCharacterIds: string[];
  useAi: boolean;
}

export function useLifeSetupJob(jobId: string | null) {
  return useQuery({
    queryKey: lifeKeys.setupJob(jobId),
    queryFn: ({ signal }) => get<LifeSetupJobDto>(`/life/setup-jobs/${jobId}`, signal),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data && query.state.data.status !== 'running' ? false : 1_000),
    staleTime: 0,
  });
}

export function useLifeSetup() {
  const qc = useQueryClient();
  return {
    start: useMutation({ mutationFn: (input: LifeSetupInput) => post<LifeSetupJobDto>('/life/setup-jobs', input) }),
    cancel: useMutation({ mutationFn: (jobId: string) => del<LifeSetupJobDto>(`/life/setup-jobs/${jobId}`) }),
    create: useMutation({
      mutationFn: (draft: LifeSetupDraft) => post<LifeStoryDto>('/life/stories', draft),
      onSuccess: (story) => {
        qc.setQueryData(lifeKeys.story(story.id), story);
        void qc.invalidateQueries({ queryKey: lifeKeys.stories });
      },
    }),
  };
}
