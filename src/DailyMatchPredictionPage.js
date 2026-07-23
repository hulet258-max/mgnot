import React, { useEffect, useMemo, useState } from "react";
import ReactCountryFlag from "react-country-flag";
import TournamentShell from "./TournamentShell";
import { useTournamentState } from "./useTournamentState";
import { useTournamentData } from "./useTournamentData";
import { useLanguage } from "./contexts/LanguageContext";
import { useBetSlip } from "./contexts/BetSlipContext";
import { countryCodeByName, getCountryName } from "./countryNames";
import { useMatchOdds } from "./useMatchOdds";
import "./PredictionPages.css";

const scoreOptions = Array.from({ length: 8 }, (_, index) => index);

const defaultPrediction = (match) => ({
  outcome: "",
  homeScore: 0,
  awayScore: 0,
  firstToScore: "",
  bothTeamsScore: "",
  totalCorners: "",
  cleanSheet: "",
  bonusEvents: [],
  matchId: match.id,
});

const formatMatchTime = (kickoff) => {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(kickoff));
};

const getCountdown = (kickoff, t) => {
  const remaining = new Date(kickoff).getTime() - Date.now();
  if (remaining <= 0) return t("matches.kickoffReached", "Kickoff reached");

  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);

  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${minutes}m`;
};

const isMatchLocked = (match) => {
  return match.status !== "open" || Date.now() >= new Date(match.kickoff).getTime() - (5 * 60 * 1000);
};

const formatOdd = (value, t) => Number.isFinite(Number(value?.points))
  ? t("common.pointsShort", "{{count}} pts", { count: Number(value.points) })
  : "-";

function DailyMatchPredictionPage() {
  const { selectedPoolId, matchPredictions, poolPredictions } = useTournamentState();
  const { matchDays, pools, loading, error } = useTournamentData();
  const { language, t, formatCurrency } = useLanguage();
  const { addBet } = useBetSlip();
  const oddsByMatch = useMatchOdds();
  const [selectedDayId, setSelectedDayId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextDrafts = {};
    matchDays.forEach((day) => {
      day.matches.forEach((match) => {
        nextDrafts[match.id] = matchPredictions[match.id] || defaultPrediction(match);
      });
    });
    setDrafts(nextDrafts);
  }, [matchDays, matchPredictions]);

  useEffect(() => {
    if (!selectedDayId && matchDays[0]?.id) {
      setSelectedDayId(matchDays[0].id);
    }
  }, [matchDays, selectedDayId]);

  const selectedDay = useMemo(
    () => matchDays.find((day) => day.id === selectedDayId) || matchDays[0] || { matches: [] },
    [matchDays, selectedDayId]
  );

  const updateMatchDraft = (match, field, value) => {
    if (!selectedPoolId) return;

    setDrafts((current) => {
      const nextDraft = {
        ...(current[match.id] || defaultPrediction(match)),
        [field]: value,
      };

      if (nextDraft.outcome) {
        addBet(match, nextDraft);
      }

      return {
        ...current,
        [match.id]: nextDraft,
      };
    });
  };

  const toggleBonus = (match, value) => {
    if (!selectedPoolId) return;

    setDrafts((current) => {
      const draft = current[match.id] || defaultPrediction(match);
      const events = draft.bonusEvents || [];
      const nextEvents = events.includes(value)
        ? events.filter((event) => event !== value)
        : [...events, value];
      const nextDraft = {
        ...draft,
        bonusEvents: nextEvents,
      };

      if (nextDraft.outcome) {
        addBet(match, nextDraft);
      }

      return {
        ...current,
        [match.id]: nextDraft,
      };
    });
  };

  return (
    <TournamentShell>
      {loading && <div className="wc-empty">{t("common.loading", "Loading...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      {!selectedPoolId && <div className="warning-band">{t("dashboard.warning", "Join a pool to activate competition tracking.")}</div>}
      <div className="date-tabs" role="tablist" aria-label={t("matches.tabsAria", "Match days")}>
        {matchDays.map((day) => (
          <button
            key={day.id}
            className={day.id === selectedDayId ? "date-tab active" : "date-tab"}
            type="button"
            onClick={() => setSelectedDayId(day.id)}
          >
            <strong>{day.label}</strong>
            <span>{new Date(day.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </button>
        ))}
      </div>

      <section className="match-list" aria-live="polite">
        {selectedDay.matches.map((match) => {
          const saved = matchPredictions[match.id];
          const locked = isMatchLocked(match);
          const draft = drafts[match.id] || defaultPrediction(match);
          const countdown = getCountdown(match.kickoff, t, tick);
          const outcomes = [
            {
              value: "home",
              team: match.homeTeam,
              label: getCountryName(match.homeTeam, language),
              flagCode: countryCodeByName[match.homeTeam] || "UN",
              odd: oddsByMatch[match.id]?.home,
            },
            {
              value: "draw",
              label: t("matches.outcome.draw", "Draw"),
              flagCode: null,
              odd: oddsByMatch[match.id]?.draw,
            },
            {
              value: "away",
              team: match.awayTeam,
              label: getCountryName(match.awayTeam, language),
              flagCode: countryCodeByName[match.awayTeam] || "UN",
              odd: oddsByMatch[match.id]?.away,
            },
          ];

          return (
            <article className={locked ? "match-card locked" : "match-card"} key={match.id}>
              <div className="match-meta">
                <span className="wc-pill">{match.group}</span>
                <span>{formatMatchTime(match.kickoff)}</span>
                <span>{match.stadium}</span>
                <span className={locked ? "countdown locked" : "countdown"}>{countdown}</span>
                <span>
                  {saved
                    ? t("matches.meta.savedForPool", "Already saved in selected pool - choose another pool to bet again")
                    : locked
                      ? t("matches.meta.closed", "Prediction closed")
                      : t("matches.meta.open", "Prediction open")}
                </span>
              </div>

              <div className="match-form">
                <div className="match-outcome-row" role="radiogroup" aria-label={t("matches.outcome.title", "Match outcome")}>
                  {outcomes.map((option) => (
                    <button
                      key={option.value}
                      className={draft.outcome === option.value ? "match-outcome-option selected" : "match-outcome-option"}
                      type="button"
                      disabled={!selectedPoolId || locked}
                      onClick={() => updateMatchDraft(match, "outcome", option.value)}
                    >
                      <PoolOutcomeMarkers
                        pools={pools}
                        poolPredictions={poolPredictions}
                        matchId={match.id}
                        outcome={option.value}
                        t={t}
                        formatCurrency={formatCurrency}
                      />
                      {option.flagCode ? (
                        <ReactCountryFlag
                          countryCode={option.flagCode}
                          svg
                          style={{ width: "1.9em", height: "1.9em" }}
                        />
                      ) : (
                        <span className="draw-dot">X</span>
                      )}
                      <span className="team-pick-copy">
                        <strong>{option.label}</strong>
                        <small>{formatOdd(option.odd, t)}</small>
                      </span>
                    </button>
                  ))}
                </div>

                {!locked && (
                  <details className="prediction-details compact">
                    <summary>
                      <span>{t("matches.additional.title", "More betting options")}</span>
                      <span className="dropdown-icon" aria-hidden="true">v</span>
                    </summary>
                    <fieldset className="prediction-fieldset score-fieldset compact-score">
                      <legend>{t("matches.score.title", "Exact score")}</legend>
                      <label>
                        <span>{match.homeCode}</span>
                        <select
                          value={draft.homeScore}
                          disabled={!selectedPoolId}
                          onChange={(event) => updateMatchDraft(match, "homeScore", Number(event.target.value))}
                        >
                          {scoreOptions.map((score) => (
                            <option key={score} value={score}>{score}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>{match.awayCode}</span>
                        <select
                          value={draft.awayScore}
                          disabled={!selectedPoolId}
                          onChange={(event) => updateMatchDraft(match, "awayScore", Number(event.target.value))}
                        >
                          {scoreOptions.map((score) => (
                            <option key={score} value={score}>{score}</option>
                          ))}
                        </select>
                      </label>
                    </fieldset>

                    <div className="additional-grid">
                      <label>
                        <span>{t("matches.additional.firstScore", "First team to score")}</span>
                        <select
                          value={draft.firstToScore}
                          disabled={!selectedPoolId}
                          onChange={(event) => updateMatchDraft(match, "firstToScore", event.target.value)}
                        >
                          <option value="">{t("matches.additional.select", "Select")}</option>
                          <option value={match.homeTeam}>{getCountryName(match.homeTeam, language)}</option>
                          <option value={match.awayTeam}>{getCountryName(match.awayTeam, language)}</option>
                          <option value="none">{t("matches.additional.noGoal", "No goal")}</option>
                        </select>
                      </label>

                      <label>
                        <span>{t("matches.additional.bothScore", "Both teams score")}</span>
                        <select
                          value={draft.bothTeamsScore}
                          disabled={!selectedPoolId}
                          onChange={(event) => updateMatchDraft(match, "bothTeamsScore", event.target.value)}
                        >
                          <option value="">{t("matches.additional.select", "Select")}</option>
                          <option value="yes">{t("common.yes", "Yes")}</option>
                          <option value="no">{t("common.no", "No")}</option>
                        </select>
                      </label>

                      <label>
                        <span>{t("matches.additional.totalCorners", "Total corners")}</span>
                        <input
                          min="0"
                          max="30"
                          type="number"
                          value={draft.totalCorners}
                          disabled={!selectedPoolId}
                          onChange={(event) => updateMatchDraft(match, "totalCorners", event.target.value)}
                          placeholder={t("matches.additional.placeholder", "Example: 9")}
                        />
                      </label>

                      <label>
                        <span>{t("matches.additional.cleanSheet", "Clean sheet")}</span>
                        <select
                          value={draft.cleanSheet}
                          disabled={!selectedPoolId}
                          onChange={(event) => updateMatchDraft(match, "cleanSheet", event.target.value)}
                        >
                          <option value="">{t("matches.additional.select", "Select")}</option>
                          <option value={match.homeTeam}>{getCountryName(match.homeTeam, language)}</option>
                          <option value={match.awayTeam}>{getCountryName(match.awayTeam, language)}</option>
                          <option value="none">{t("matches.additional.none", "None")}</option>
                        </select>
                      </label>
                    </div>

                    <div className="bonus-options">
                      {[
                        t("matches.bonus.penalty", "Penalty scored"),
                        t("matches.bonus.redCard", "Red card"),
                        t("matches.bonus.lateGoal", "Goal after 80 minutes"),
                      ].map((event) => (
                        <label key={event}>
                          <input
                            type="checkbox"
                            checked={(draft.bonusEvents || []).includes(event)}
                            disabled={!selectedPoolId}
                            onChange={() => toggleBonus(match, event)}
                          />
                          {event}
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </div>

              {locked && <LockedMatchView match={match} prediction={saved} />}
            </article>
          );
        })}
      </section>
    </TournamentShell>
  );
}

function indexPoolColor(pools, poolId) {
  return Math.max(0, pools.findIndex((pool) => pool.id === poolId)) % 3;
}

function PoolOutcomeMarkers({ pools, poolPredictions, matchId, outcome, t, formatCurrency }) {
  const matchingPools = pools.filter((pool) => (
    poolPredictions?.[pool.id]?.matchPredictions?.[matchId]?.outcome === outcome
  ));

  if (!matchingPools.length) return null;

  return (
    <span className="prediction-pool-markers" aria-label={t("betSlip.saveToPools", "Save to pools")}>
      {matchingPools.map((pool) => (
        <span
          key={pool.id}
          className={`prediction-pool-marker pool-marker-${indexPoolColor(pools, pool.id)}`}
          title={t("currency.pool", "{{amount}} Birr pool", { amount: Number(pool.amount || 0).toLocaleString() })}
        >
          {formatCurrency(pool.amount)}
        </span>
      ))}
    </span>
  );
}

function LockedMatchView({ match, prediction }) {
  const { t } = useLanguage();

  if (!prediction) {
    return <div className="locked-view">{t("matches.locked.noSelection", "Prediction closed. No submitted selections found.")}</div>;
  }

  return (
    <div className="locked-view">
      <div>
        <span>{t("matches.locked.submitted", "Submitted prediction")}</span>
        <strong>{prediction.homeScore} - {prediction.awayScore}</strong>
      </div>
      <div>
        <span>{t("matches.locked.outcomePick", "Outcome pick")}</span>
        <strong>{prediction.outcome || t("matches.locked.notSelected", "Not selected")}</strong>
      </div>
      {match.finalScore ? (
        <>
          <div>
            <span>{t("matches.locked.finalResult", "Final result")}</span>
            <strong>{match.finalScore}</strong>
          </div>
          <div>
            <span>{t("matches.locked.pointsEarned", "Points earned")}</span>
            <strong>{prediction.pointsEarned || 0}</strong>
          </div>
        </>
      ) : (
        <div>
          <span>{t("group.summary.status", "Status")}</span>
          <strong>{t("common.pending", "Pending")}</strong>
        </div>
      )}
    </div>
  );
}

export default DailyMatchPredictionPage;
