import React from "react";
import TournamentShell from "./TournamentShell";
import { useTournamentState } from "./useTournamentState";
import { useTournamentData } from "./useTournamentData";
import { useLanguage } from "./contexts/LanguageContext";
import { getCountryName } from "./countryNames";
import "./PredictionPages.css";

const getTeamById = (group, teamId) => group.teams.find((team) => team.id === teamId);

const getOutcomeLabel = (match, outcome, language, t) => {
  if (outcome === "home") return t("matches.outcome.homeWin", "{{team}} wins", { team: getCountryName(match.homeTeam, language) });
  if (outcome === "away") return t("matches.outcome.awayWin", "{{team}} wins", { team: getCountryName(match.awayTeam, language) });
  if (outcome === "draw") return t("matches.outcome.draw", "Draw");
  return t("group.position.notSelected", "Not selected");
};

const isMatchLocked = (match) => {
  return match.status !== "open" || new Date(match.kickoff).getTime() <= Date.now();
};

function MyPredictionsPage() {
  const { groupPredictions, groupPredictionsLocked, matchPredictions } = useTournamentState();
  const { groups, matchDays, loading, error } = useTournamentData();
  const { language, t } = useLanguage();
  const savedMatches = Object.keys(matchPredictions);
  const exactScores = savedMatches.filter((matchId) => {
    const prediction = matchPredictions[matchId];
    return prediction && prediction.homeScore !== "" && prediction.awayScore !== "";
  }).length;
  const totalPoints = savedMatches.reduce((sum, matchId) => {
    return sum + Number(matchPredictions[matchId]?.pointsEarned || 0);
  }, 0);

  const stats = [
    {
      label: t("history.stats.totalPredictions", "Total Predictions"),
      value: savedMatches.length + (groupPredictionsLocked ? groups.length : 0),
    },
    { label: t("history.stats.correctPredictions", "Correct Predictions"), value: "0" },
    { label: t("history.stats.accuracy", "Accuracy Percentage"), value: "0%" },
    { label: t("history.stats.totalExact", "Total Exact Scores"), value: exactScores },
    { label: t("history.stats.totalPoints", "Total Points"), value: totalPoints },
  ];

  return (
    <TournamentShell
      eyebrow={t("history.eyebrow", "My predictions")}
      title={t("history.title", "Prediction History")}
      subtitle={t(
        "history.subtitle",
        "Review your locked group selections and every saved daily match prediction."
      )}
    >
      {loading && <div className="wc-empty">{t("common.loading", "Loading...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      <section className="wc-grid cols-3">
        {stats.map((stat) => (
          <div className="wc-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </section>

      <section className="wc-section">
        <h2 className="wc-section-title">{t("history.groups.title", "Group Predictions")}</h2>
        <div className="history-group-list">
          {groups.map((group) => {
            const order = groupPredictions[group.id] || [];
            return (
              <article className="history-group" key={group.id}>
                <div>
                  <h3>{group.name}</h3>
                  <span className="wc-pill">
                    {groupPredictionsLocked
                      ? t("history.groups.locked", "Locked")
                      : t("history.groups.open", "Open")}
                  </span>
                </div>
                <ol>
                  {order.map((teamId, index) => {
                    const team = getTeamById(group, teamId);
                    return (
                      <li key={`${group.id}-${index}`}>
                        <span>{index + 1}</span>
                        <strong>{team ? getCountryName(team.name, language) : t("history.groups.notSelected", "Not selected")}</strong>
                      </li>
                    );
                  })}
                </ol>
              </article>
            );
          })}
        </div>
      </section>

      <section className="wc-section">
        <h2 className="wc-section-title">{t("history.daily.title", "Daily Predictions")}</h2>
        <div className="daily-history">
          {matchDays.map((day) => (
            <article className="history-day" key={day.id}>
              <h3>{day.label}</h3>
              <div className="history-match-list">
                {day.matches.map((match) => {
                  const prediction = matchPredictions[match.id];
                  return (
                    <div className="history-match" key={match.id}>
                      <div>
                        <strong>{getCountryName(match.homeTeam, language)} vs {getCountryName(match.awayTeam, language)}</strong>
                        <span>{match.stadium}</span>
                      </div>
                      <div>
                        <span>{t("history.daily.submitted", "Submitted Prediction")}</span>
                        <strong>
                          {prediction
                            ? `${prediction.homeScore}-${prediction.awayScore}, ${getOutcomeLabel(match, prediction.outcome, language, t)}`
                            : t("history.daily.notSubmitted", "Not submitted")}
                        </strong>
                      </div>
                      <div>
                        <span>{t("history.daily.finalResult", "Final Result")}</span>
                        <strong>{match.finalScore || t("history.daily.pending", "Pending")}</strong>
                      </div>
                      <div>
                        <span>{t("history.daily.pointsGained", "Points Gained")}</span>
                        <strong>{prediction?.pointsEarned || 0}</strong>
                      </div>
                      <div>
                        <span>{t("history.daily.status", "Status")}</span>
                        <strong>{isMatchLocked(match) ? t("common.locked", "Locked") : t("common.open", "Open")}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </TournamentShell>
  );
}

export default MyPredictionsPage;
