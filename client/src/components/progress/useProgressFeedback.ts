import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ProgressDelta } from '../../../../shared/types';
import { invalidateProgress } from '../../api/hooks';
import { useI18n } from '../../i18n';
import { errorMessage } from '../../lib/format';
import { useToast } from '../ui/Toast';

/** Zeigt XP, Level-Aufstiege und neue Erfolge nach einer Aktion als Hinweis an. */
export function useProgressFeedback() {
  const { push } = useToast();
  const { t, td } = useI18n();
  const qc = useQueryClient();
  return useCallback(
    (delta?: ProgressDelta | null) => {
      if (!delta) return;
      // XP-Anzeige (Seitenleiste, Profil, Fortschritt) sofort aktualisieren.
      if (delta.xpGained > 0 || delta.levelUp || delta.achievementsUnlocked.length > 0) invalidateProgress(qc);
      if (delta.xpGained > 0) push('xp', t('toasts.xp', { xp: delta.xpGained }));
      if (delta.coinsGained) push('xp', t('tasks.coinsGained', { coins: delta.coinsGained }));
      if (delta.levelUp) push('success', t('toasts.levelUp', { level: delta.levelUp }), t('toasts.levelUpHint'));
      for (const id of delta.achievementsUnlocked) {
        push('success', t('toasts.achievement', { name: td(`achievements.${id}`, id) }), td(`achievements.${id}.desc`, ''));
      }
    },
    [push, t, td, qc],
  );
}

export function useErrorToast() {
  const { push } = useToast();
  const { td } = useI18n();
  return useCallback((error: unknown) => push('error', errorMessage(error, td)), [push, td]);
}
