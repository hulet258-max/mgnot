import React from "react";
import { useNavigate } from "react-router-dom";
import TournamentShell from "./TournamentShell";
import { useTournamentState } from "./useTournamentState";
import { useTournamentData } from "./useTournamentData";
import { useLanguage } from "./contexts/LanguageContext";
import "./PredictionPages.css";

function DashboardPage() {
  const navigate = useNavigate();
  const { t, formatCurrency } = useLanguage();
  const { matchDays, pools, recentActivity, tournamentInfo, loading, error } = useTournamentData();
  const {
    selectedPoolId,
    groupPredictionsLocked,
    groupCompletion,
    matchPredictions,
    completedGroups,
  } = useTournamentState();
  const selectedPool = pools.find((pool) => pool.id === selectedPoolId);
  const savedMatches = Object.keys(matchPredictions).length;
  const totalPoints = (groupPredictionsLocked ? 24 : 0) + savedMatches * 3 + completedGroups;
  const accuracy = savedMatches ? Math.min(92, 58 + savedMatches * 4) : 0;
  const streak = savedMatches ? Math.min(savedMatches, 8) : 0;

  const performanceCards = [
    {
      label: t("dashboard.cards.currentRank", "Current Rank"),
      value: selectedPool ? "#18" : t("common.none", "N/A"),
    },
    { label: t("dashboard.cards.totalPoints", "Total Points"), value: totalPoints },
    { label: t("dashboard.cards.predictionAccuracy", "Prediction Accuracy"), value: `${accuracy}%` },
    { label: t("dashboard.cards.currentStreak", "Current Streak"), value: streak },
    {
      label: t("dashboard.cards.poolPosition", "Pool Position"),
      value: selectedPool ? `18 / ${selectedPool.participants}` : t("dashboard.cards.noPool", "No pool"),
    },
    {
      label: t("dashboard.cards.qualificationStatus", "Qualification Status"),
      value: groupPredictionsLocked
        ? t("dashboard.cards.inZone", "In Zone")
        : t("dashboard.cards.pending", "Pending"),
    },
  ];

  const progressCards = [
    { label: t("dashboard.progress.currentDay", "Current Tournament Day"), value: "Day 1" },
    { label: t("dashboard.progress.currentStage", "Current Stage"), value: tournamentInfo.stageStatus },
    { label: t("dashboard.progress.completedMatches", "Completed Matches"), value: "0" },
    { label: t("dashboard.progress.remainingMatches", "Remaining Matches"), value: "104" },
    { label: t("dashboard.progress.todayCount", "Today's Match Count"), value: matchDays[0]?.matches?.length || 0 },
  ];

  return (
    <TournamentShell
      eyebrow={t("dashboard.eyebrow", "Dashboard")}
      title={t("dashboard.title", "Your Tournament Control Center")}
      subtitle={t(
        "dashboard.subtitle",
        "Track performance, jump into daily predictions, and monitor progress through the group stage."
      )}
    >
      {loading && <div className="wc-empty">{t("common.loading", "Loading...")}</div>}
      {!loading && error && <div className="wc-empty">{error}</div>}
      {!selectedPool && (
        <div className="warning-band">
          {t("dashboard.warning", "Join a pool to activate competition tracking.")}
          <button type="button" onClick={() => navigate("/pools")}>
            {t("dashboard.joinPool", "Join Pool")}
          </button>
        </div>
      )}

      <section className="wc-grid cols-3">
        {performanceCards.map((card) => (
          <div className="wc-stat" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </section>

      <section className="wc-section dashboard-progress">
        <h2 className="wc-section-title">{t("dashboard.progress.title", "Tournament Progress")}</h2>
        <div className="wc-grid cols-4">
          {progressCards.map((card) => (
            <div className="progress-tile" key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="wc-section dashboard-actions">
        <button className="wc-button" type="button" onClick={() => navigate("/matches")}>
          {t("dashboard.actions.predictToday", "Predict Today's Matches")}
        </button>
        <button className="wc-button secondary" type="button" onClick={() => navigate("/leaderboard")}>
          {t("dashboard.actions.viewRankings", "View Rankings")}
        </button>
        <button className="wc-button secondary" type="button" onClick={() => navigate("/my-predictions")}>
          {t("dashboard.actions.myPredictions", "My Predictions")}
        </button>
        <button className="wc-button secondary" type="button" onClick={() => navigate("/group-predictions")}>
          {t("dashboard.actions.tournamentStatus", "Tournament Status")}
        </button>
      </section>

      <section className="wc-section">
        <h2 className="wc-section-title">{t("dashboard.readiness.title", "Prediction Readiness")}</h2>
        <div className="readiness-row">
          <div>
            <span>{t("dashboard.readiness.groupPredictions", "Group predictions")}</span>
            <strong>
              {groupPredictionsLocked
                ? t("common.locked", "Locked")
                : t("dashboard.readiness.complete", "{{count}}% complete", { count: groupCompletion })}
            </strong>
          </div>
          <div>
            <span>{t("dashboard.readiness.dailyPredictions", "Daily match predictions")}</span>
            <strong>{t("dashboard.readiness.saved", "{{count}} saved", { count: savedMatches })}</strong>
          </div>
          <div>
            <span>{t("dashboard.readiness.selectedPool", "Selected pool")}</span>
            <strong>{selectedPool ? formatCurrency(selectedPool.amount) : t("common.none", "None")}</strong>
          </div>
        </div>
      </section>

      <section className="wc-section">
        <h2 className="wc-section-title">{t("dashboard.activity.title", "Recent Activity")}</h2>
        <div className="activity-list">
          {recentActivity.map((activity, index) => (
            <div className="activity-item" key={activity}>
              <span>{index + 1}</span>
              <p>{activity}</p>
            </div>
          ))}
        </div>
      </section>
    </TournamentShell>
  );
}

export default DashboardPage;
