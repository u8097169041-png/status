import {
  CheckCircle2,
  Circle,
  Crown,
  Lock,
  Megaphone,
  Sparkles,
  Star,
  Swords,
  Zap,
} from "lucide-react";
import { Link } from "react-router";
import type {
  PlayerDto,
  QuestDto,
  QuestObjectiveDto,
  QuestRewardsDto,
} from "../../../../shared/types";
import { useReactToEvent } from "../../api/hooks";
import { useI18n, type TKey } from "../../i18n";
import { formatNumber } from "../../lib/format";
import {
  useErrorToast,
  useProgressFeedback,
} from "../progress/useProgressFeedback";
import { useToast } from "../ui/Toast";

function objectiveLabel(
  o: QuestObjectiveDto,
  t: (k: TKey, v?: Record<string, string | number>) => string,
): string {
  const named =
    o.name &&
    (o.metric === "arcDecisions" ||
      o.metric === "arcResolved" ||
      o.metric === "eventReaction");
  return t(
    (named
      ? `questMetrics.${o.metric}Named`
      : `questMetrics.${o.metric}`) as TKey,
    { name: o.name ?? "" },
  );
}

function Objective({ objective }: { objective: QuestObjectiveDto }) {
  const { t } = useI18n();
  const label = objectiveLabel(objective, t);
  const pct = objective.done
    ? 100
    : objective.target > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((objective.current / objective.target) * 100),
          ),
        )
      : Math.max(
          0,
          Math.min(100, 100 - (objective.target - objective.current)),
        );
  return (
    <li className={`objective ${objective.done ? "done" : ""}`}>
      {objective.done ? (
        <CheckCircle2 aria-hidden className="icon-xs" />
      ) : (
        <Circle aria-hidden className="icon-xs" />
      )}
      <span className="grow min-w-0 small">{label}</span>
      <span className="xsmall faint objective-count">
        {objective.current}/{objective.target}
      </span>
      <div
        className="progress progress-sm objective-bar"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function RewardChips({ quest }: { quest: QuestDto }) {
  const { t } = useI18n();
  const r: QuestRewardsDto = quest.rewards;
  return (
    <span className="row wrap quest-rewards">
      <span className="badge">+{quest.xp} XP</span>
      {quest.coins > 0 && (
        <span className="badge badge-coins">+{quest.coins}</span>
      )}
      {r.reputation ? (
        <span className="badge">{`${t("play.reputation")} +${r.reputation}`}</span>
      ) : null}
      {r.influence ? (
        <span className="badge">{`${t("play.influence")} +${r.influence}`}</span>
      ) : null}
      {r.followers ? (
        <span className="badge">{`${t("play.followers")} +${r.followers}`}</span>
      ) : null}
    </span>
  );
}

function EventReactButton({
  quest,
  mediaLevel,
}: {
  quest: QuestDto;
  mediaLevel: number;
}) {
  const { t } = useI18n();
  const react = useReactToEvent();
  const feedback = useProgressFeedback();
  const showError = useErrorToast();
  const { push } = useToast();
  if (!quest.eventId || quest.status !== "active") return null;
  if (mediaLevel < 1) {
    return (
      <span className="xsmall faint row">
        <Lock aria-hidden className="icon-xs" /> {t("questBoard.reactLocked")}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      disabled={react.isPending}
      onClick={() =>
        react.mutate(
          { eventId: quest.eventId! },
          {
            onSuccess: (r) => {
              push(
                "success",
                t("questBoard.reacted"),
                t("composer.reach", { followers: r.reach.followers }),
              );
              feedback(r.progress);
            },
            onError: showError,
          },
        )
      }
    >
      <Megaphone aria-hidden /> {t("questBoard.react")}
    </button>
  );
}

/** Quest mit Zielen je Lösungsweg. Gesperrte alternative Wege zeigen die nötige Fähigkeit. */
export function QuestCard({
  quest,
  highlight,
  mediaLevel = 0,
}: {
  quest: QuestDto;
  highlight?: boolean;
  mediaLevel?: number;
}) {
  const { t } = useI18n();
  const pct = Math.round(quest.progress * 100);
  const Icon =
    quest.kind === "main" ? Crown : quest.kind === "event" ? Zap : Star;
  return (
    <article
      className={`quest-card card ${highlight ? "quest-main" : ""} ${quest.status}`}
      aria-labelledby={`quest-${quest.id}`}
    >
      <header className="quest-card-header">
        <span className="quest-kind">
          <Icon aria-hidden />
        </span>
        <div className="grow min-w-0">
          <span className="xsmall muted">
            {quest.kind === "main"
              ? `${t("questBoard.main")} · ${t("questBoard.stage", { stage: quest.stage, total: quest.stages })}`
              : quest.kind === "event"
                ? `${t("questBoard.simulated")}${quest.expiresDay ? ` · ${t("questBoard.expires", { day: quest.expiresDay })}` : ""}`
                : t("questBoard.side")}
          </span>
          <h3 id={`quest-${quest.id}`}>{quest.title}</h3>
        </div>
        {quest.status === "completed" && (
          <span className="badge badge-success">{t("questBoard.done")}</span>
        )}
      </header>
      <p className="small muted">{quest.description}</p>
      {quest.status === "active" && (
        <div
          className="progress"
          role="progressbar"
          aria-label={quest.title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
      )}
      <div className="quest-paths">
        {quest.paths.map((path, i) => (
          <div key={i} className={`quest-path ${path.locked ? "locked" : ""}`}>
            {i > 0 && (
              <span className="quest-path-label xsmall">
                {path.locked ? (
                  <Lock aria-hidden className="icon-xs" />
                ) : (
                  <Sparkles aria-hidden className="icon-xs" />
                )}
                {t("questBoard.orPath")} · {t("questBoard.altPath")}
                {path.requires &&
                  ` · ${t("questBoard.requires", { skill: t(`skills.${path.requires.skill}` as TKey), level: path.requires.level })}`}
              </span>
            )}
            <ul className="objectives">
              {path.objectives.map((o, j) => (
                <Objective key={j} objective={o} />
              ))}
            </ul>
          </div>
        ))}
      </div>
      <footer className="row-between wrap quest-card-footer">
        <RewardChips quest={quest} />
        {quest.kind === "event" && (
          <EventReactButton quest={quest} mediaLevel={mediaLevel} />
        )}
      </footer>
    </article>
  );
}

/** Charakterlevel mit XP-Balken und freien Fähigkeitspunkten. */
export function LevelCard({
  player,
  hideSkillsLink,
}: {
  player: PlayerDto;
  hideSkillsLink?: boolean;
}) {
  const { t, td, locale } = useI18n();
  const l = player.level;
  const pct = Math.round(l.progress * 100);
  return (
    <section
      className="level-card card"
      aria-label={t("questBoard.levelTitle")}
    >
      <div className="char-level-ring" aria-hidden>
        <span>{l.level}</span>
      </div>
      <div className="grow min-w-0 stack-xs">
        <div className="row-between wrap">
          <strong>
            {t("questBoard.levelTitle")} · {t("play.level", { level: l.level })}
          </strong>
          <span className="xsmall muted">
            {t("play.xpOf", {
              xp: formatNumber(l.xp - l.currentLevelXp, locale),
              next: formatNumber(l.nextLevelXp - l.currentLevelXp, locale),
            })}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label={t("questBoard.levelTitle")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${pct}%` }} />
        </div>
        <span className="xsmall faint">
          {t("questBoard.levelHint", {
            name: player.character.name,
            world: player.worldName,
          })}{" "}
          ·{" "}
          {t("play.roleLabel", {
            archetype: td(`archetypes.${player.archetype}`, player.archetype),
            goal: td(`goals.${player.goalType}`, player.goalType),
          })}
        </span>
      </div>
      {!hideSkillsLink && (
        <Link
          to="/skills"
          className={`btn btn-sm ${player.skillPoints.available > 0 ? "btn-primary" : "btn-secondary"}`}
        >
          <Swords aria-hidden /> {t("nav.skills")}
          {player.skillPoints.available > 0 && (
            <span className="badge badge-coins">
              {player.skillPoints.available}
            </span>
          )}
        </Link>
      )}
    </section>
  );
}
