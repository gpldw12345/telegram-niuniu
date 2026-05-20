import { AdminShell } from "../../../AdminShell";
import { Topbar } from "../../../components";
import { getCorrectScore } from "../../../adminData";

export const dynamic = "force-dynamic";

export default async function CorrectScorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCorrectScore(id);
  const scoresByKey = new Map(data.scores.map((score) => [score.key, score]));

  return (
    <AdminShell active="Matches">
      <Topbar eyebrow="Correct Score" error={null} title={`${data.match.homeTeam} vs ${data.match.awayTeam}`} />
      <section className="panel">
        <div className="panel-header">
          <h3>Correct Score Odds</h3>
          <a className="panel-link" href="/matches">Back</a>
        </div>
        <form action={`/api/matches/${id}/correct-score`} method="post">
          <div className="cs-grid">
            {data.rows.flatMap((row, rowIndex) =>
              row.map((key, columnIndex) => {
                const score = key ? scoresByKey.get(key) : null;

                if (!score) {
                  return <div aria-hidden="true" className="cs-field cs-field-empty" key={`${rowIndex}-${columnIndex}`} />;
                }

                return (
                  <div className="cs-field" key={score.key}>
                    <label htmlFor={`score-${score.key}`}>{score.label}</label>
                    <input
                      defaultValue={score.odds}
                      id={`score-${score.key}`}
                      min="1"
                      name={`odds_${score.key}`}
                      placeholder="Odds"
                      step="0.01"
                      type="number"
                    />
                  </div>
                );
              })
            )}
          </div>
          <div className="panel-footer">
            <button type="submit">Save Correct Score Odds</button>
          </div>
        </form>
      </section>
    </AdminShell>
  );
}
