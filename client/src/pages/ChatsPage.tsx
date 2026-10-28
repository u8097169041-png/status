import { ArrowLeft, Brain, Eye, MessageCirclePlus, MessagesSquare, Plus, Send, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LIMITS } from '../../../shared/constants';
import type { ChatDetail } from '../../../shared/types';
import { ApiError } from '../api/client';
import { useCharacters, useChat, useChatActions, useChats, usePromptPreview } from '../api/hooks';
import { AuthorName } from '../components/feed/AuthorLine';
import { ChatActionsBar } from '../components/play/ChatActionsBar';
import { NotJoinedState, useActivePlay } from '../components/play/PlayUI';
import { useErrorToast, useProgressFeedback } from '../components/progress/useProgressFeedback';
import { Avatar } from '../components/ui/Avatar';
import { Toggle } from '../components/ui/Form';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { RelativeTime } from '../components/ui/RelativeTime';
import { EmptyState, ErrorState, Loading } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n';
import { formatTime } from '../lib/format';

function NewChatModal({ worldId, onClose }: { worldId: string; onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Nur Figuren der aktiven Welt, ohne die eigene Spielfigur.
  const { data: characters } = useCharacters({ world: worldId, npc: true });
  const [search, setSearch] = useState('');
  const list = (characters ?? []).filter((c) => `${c.name} ${c.handle} ${c.worldName ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <Modal title={t('chats.start')} onClose={onClose}>
      <input
        type="search"
        className="input"
        placeholder={t('common.search')}
        aria-label={t('common.search')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        data-autofocus
      />
      <ul className="pick-list">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              className="pick-row"
              onClick={() => {
                onClose();
                navigate(`/chats/${c.id}`);
              }}
            >
              <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="md" decorative />
              <span className="grow">
                <strong className="small">{c.name}</strong>
                <span className="xsmall muted block truncate">{c.role}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

function MemoryPanel({ chat, onClose }: { chat: ChatDetail; onClose: () => void }) {
  const { t } = useI18n();
  const actions = useChatActions(chat.characterId);
  const showError = useErrorToast();
  const [fact, setFact] = useState('');
  const facts = chat.memories.filter((m) => m.kind === 'fact');
  const summary = chat.memories.find((m) => m.kind === 'summary');
  const sourceLabel = (s: string) => (s === 'rule' ? t('chats.sourceRule') : s === 'ai' ? t('chats.sourceAi') : t('chats.sourceUser'));
  return (
    <Modal title={t('chats.memoryTitle')} onClose={onClose}>
      <p className="small muted">{t('chats.memoryExplain', { window: chat.memoryWindow })}</p>
      <Toggle
        label={t('chats.memoryEnabled')}
        checked={chat.memoryEnabled}
        onChange={(v) => actions.settings.mutate({ memoryEnabled: v }, { onError: showError })}
      />
      <div className="field">
        <label className="field-label" htmlFor="memory-window">
          {t('chats.memoryWindow')}: {chat.memoryWindow}
        </label>
        <input
          id="memory-window"
          type="range"
          min={LIMITS.memoryWindowMin}
          max={LIMITS.memoryWindowMax}
          value={chat.memoryWindow}
          disabled={!chat.memoryEnabled}
          onChange={(e) => actions.settings.mutate({ memoryWindow: Number(e.target.value) }, { onError: showError })}
        />
      </div>
      <section className="stack-sm">
        <h3 className="card-heading">{t('chats.facts')}</h3>
        {facts.length === 0 ? (
          <p className="xsmall muted">{t('chats.factsEmpty')}</p>
        ) : (
          <ul className="memory-list">
            {facts.map((m) => (
              <li key={m.id}>
                <span className="grow small">{m.content}</span>
                <span className="xsmall faint">{sourceLabel(m.source)}</span>
                <button
                  type="button"
                  className="icon-btn small-icon"
                  aria-label={`${t('common.remove')}: ${m.content}`}
                  onClick={() => actions.removeMemory.mutate(m.id, { onError: showError })}
                >
                  <X />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fact.trim()) return;
            actions.addMemory.mutate(fact, { onSuccess: () => setFact(''), onError: showError });
          }}
        >
          <input
            className="input"
            value={fact}
            maxLength={LIMITS.memoryEntry}
            placeholder={t('chats.addFactPlaceholder')}
            aria-label={t('chats.addFact')}
            onChange={(e) => setFact(e.target.value)}
          />
          <button type="submit" className="btn btn-secondary" disabled={!fact.trim()} aria-label={t('chats.addFact')}>
            <Plus />
          </button>
        </form>
      </section>
      <section className="stack-sm">
        <h3 className="card-heading">{t('chats.summary')}</h3>
        {summary ? (
          <p className="small muted">
            {summary.content} <span className="xsmall faint">({sourceLabel(summary.source)})</span>
          </p>
        ) : (
          <p className="xsmall muted">{t('chats.summaryEmpty')}</p>
        )}
      </section>
    </Modal>
  );
}

function PromptPreviewModal({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const { t } = useI18n();
  const preview = usePromptPreview(characterId, true);
  return (
    <Modal title={t('chats.previewTitle')} onClose={onClose} wide>
      {preview.isPending && <Loading />}
      {preview.isError && <ErrorState error={preview.error} />}
      {preview.data && (
        <>
          <p className="small muted">
            {preview.data.mode === 'ai' ? t('chats.previewAi', { model: preview.data.model ?? '?' }) : t('chats.previewDemo')}
          </p>
          {preview.data.messages.map((m, i) => (
            <div key={i} className="stack-sm">
              <span className="badge">{m.role}</span>
              <pre className="code-block">{m.content}</pre>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

function Conversation({ characterId }: { characterId: string }) {
  const { t, td, locale } = useI18n();
  const navigate = useNavigate();
  const chat = useChat(characterId);
  const actions = useChatActions(characterId);
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  const [draft, setDraft] = useState('');
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = actions.send.isPending ? actions.send.variables : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.data?.messages.length, pending]);

  useEffect(() => {
    setDraft('');
    inputRef.current?.focus();
  }, [characterId]);

  if (chat.isPending) return <Loading />;
  if (chat.isError) {
    if (chat.error instanceof ApiError && chat.error.code === 'not_joined') return <NotJoinedState />;
    return <ErrorState error={chat.error} onRetry={() => void chat.refetch()} />;
  }
  const data = chat.data;
  const c = data.character;

  const send = (text: string) => {
    const content = text.trim();
    if (!content || content.length > LIMITS.chatMessage || actions.send.isPending) return;
    setDraft('');
    actions.send.mutate(content, {
      onSuccess: (r) => {
        feedback(r.progress);
        if (r.notice) push('info', t('chats.fallbackNotice', { reason: td(`aiErrors.${r.notice.code}`, r.notice.code) }));
      },
      onError: (error) => {
        setDraft(content);
        showError(error);
      },
    });
  };

  return (
    <section className="conversation" aria-label={c.name}>
      <header className="conversation-header">
        <button type="button" className="icon-btn mobile-only" onClick={() => navigate('/chats')} aria-label={t('common.back')}>
          <ArrowLeft />
        </button>
        <Link to={`/characters/${c.id}`} className="row grow min-w-0" aria-label={t('chats.viewProfile')}>
          <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="md" decorative />
          <span className="min-w-0">
            <strong className="block truncate">{c.name}</strong>
            <span className="xsmall muted block truncate">
              {c.role} · {td(`moods.${c.mood}`, c.mood)}
            </span>
          </span>
        </Link>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMemoryOpen(true)} aria-label={t('chats.memory')}>
          <Brain aria-hidden /> <span className="hide-mobile">{t('chats.memory')}</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => setPreviewOpen(true)} aria-label={t('chats.preview')} title={t('chats.preview')}>
          <Eye />
        </button>
        <button type="button" className="icon-btn" onClick={() => setConfirmClear(true)} aria-label={t('chats.clear')} title={t('chats.clear')} disabled={data.messages.length === 0}>
          <Trash2 />
        </button>
      </header>

      <div className="messages" aria-live="polite">
        {data.messages.length === 0 && !pending && (
          <div className="chat-empty">
            <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="xl" decorative />
            <AuthorName author={{ type: 'character', id: c.id, name: c.name, handle: c.handle, avatarHue: c.avatarHue, avatarGlyph: c.avatarGlyph, isRealPersonSim: c.isRealPersonSim, worldId: c.worldId, verified: c.prominent }} />
            <p className="small muted center-text">{c.tagline}</p>
            <p className="small">{t('chats.sayHello', { name: c.name })}</p>
            <div className="chip-row center">
              {[t('chats.suggestion1'), t('chats.suggestion2'), t('chats.suggestion3')].map((s) => (
                <button key={s} type="button" className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {data.messages.map((m) => (
          <div key={m.id} className={`message ${m.role}`}>
            {m.role === 'assistant' && <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="sm" decorative />}
            <div className="message-stack">
              <div className="bubble">{m.content}</div>
              <span className="message-meta">
                {formatTime(m.createdAt, locale)}
                {m.role === 'assistant' && (m.source === 'ai' ? ` · ${t('chats.aiReply', { model: m.model ?? '?' })}` : ` · ${t('chats.demoReply')}`)}
              </span>
            </div>
          </div>
        ))}
        {pending && (
          <>
            <div className="message user pending">
              <div className="message-stack">
                <div className="bubble">{pending}</div>
              </div>
            </div>
            <div className="message assistant">
              <Avatar name={c.name} hue={c.avatarHue} glyph={c.avatarGlyph} size="sm" decorative />
              <div className="bubble typing" aria-label={t('chats.typing', { name: c.name })}>
                <span />
                <span />
                <span />
              </div>
            </div>
          </>
        )}
        <div ref={endRef} />
      </div>

      <ChatActionsBar characterId={characterId} characterName={c.name} disabled={actions.send.isPending} />
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <textarea
          ref={inputRef}
          className="textarea"
          rows={1}
          value={draft}
          placeholder={t('chats.placeholder', { name: c.name })}
          aria-label={t('chats.placeholder', { name: c.name })}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
        />
        <button type="submit" className="btn btn-primary" disabled={!draft.trim() || draft.length > LIMITS.chatMessage || actions.send.isPending} aria-label={t('common.send')}>
          {actions.send.isPending ? <span className="spinner" aria-hidden /> : <Send aria-hidden />}
        </button>
      </form>
      {draft.length > LIMITS.chatMessage * 0.8 && (
        <span className={`char-count composer-count ${draft.length > LIMITS.chatMessage ? 'over' : ''}`}>
          {draft.length}/{LIMITS.chatMessage}
        </span>
      )}

      {memoryOpen && <MemoryPanel chat={data} onClose={() => setMemoryOpen(false)} />}
      {previewOpen && <PromptPreviewModal characterId={characterId} onClose={() => setPreviewOpen(false)} />}
      {confirmClear && (
        <ConfirmDialog
          title={t('chats.clear')}
          text={t('chats.confirmClear')}
          confirmLabel={t('common.delete')}
          danger
          busy={actions.clear.isPending}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() =>
            actions.clear.mutate(undefined, {
              onSuccess: () => {
                setConfirmClear(false);
                push('success', t('chats.cleared'));
              },
              onError: showError,
            })
          }
        />
      )}
    </section>
  );
}

export function ChatsPage() {
  const { characterId } = useParams();
  const { t } = useI18n();
  const { worldId, world, player } = useActivePlay();
  const chats = useChats(worldId);
  const [newOpen, setNewOpen] = useState(false);
  const sorted = useMemo(() => chats.data ?? [], [chats.data]);

  if (!worldId || !player) {
    return (
      <div className="page">
        <NotJoinedState />
      </div>
    );
  }

  return (
    <div className={`page chat-page ${characterId ? 'has-active' : ''}`}>
      <div className="chat-layout">
        <aside className="chat-list-pane" aria-label={t('chats.title')}>
          <div className="row-between chat-list-header">
            <span className="min-w-0">
              <h1>{t('chats.title')}</h1>
              <span className="xsmall muted block truncate">
                {t('play.playingAs', { name: player.character.name })} · {world?.name}
              </span>
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>
              <MessageCirclePlus aria-hidden /> {t('chats.start')}
            </button>
          </div>
          {chats.isPending && <Loading />}
          {chats.isError && <ErrorState error={chats.error} onRetry={() => void chats.refetch()} />}
          {chats.data && sorted.length === 0 && <EmptyState icon={MessagesSquare} title={t('chats.empty')} text={t('chats.emptyHint')} />}
          <ul className="chat-list">
            {sorted.map((chat) => (
              <li key={chat.characterId}>
                <Link to={`/chats/${chat.characterId}`} className={`chat-row ${chat.characterId === characterId ? 'active' : ''}`} aria-current={chat.characterId === characterId ? 'page' : undefined}>
                  <Avatar name={chat.character.name} hue={chat.character.avatarHue} glyph={chat.character.avatarGlyph} size="md" decorative />
                  <span className="grow min-w-0">
                    <span className="row-between">
                      <strong className="small truncate">{chat.character.name}</strong>
                      {chat.lastMessageAt && (
                        <span className="xsmall faint">
                          <RelativeTime iso={chat.lastMessageAt} />
                        </span>
                      )}
                    </span>
                    <span className="xsmall muted block truncate">{chat.lastMessage}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
        <div className="chat-main">
          {characterId ? (
            <Conversation characterId={characterId} />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title={t('chats.choose')}
              action={
                <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
                  <MessageCirclePlus aria-hidden /> {t('chats.start')}
                </button>
              }
            />
          )}
        </div>
      </div>
      {newOpen && <NewChatModal worldId={worldId} onClose={() => setNewOpen(false)} />}
    </div>
  );
}
