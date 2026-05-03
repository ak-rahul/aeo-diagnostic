"""
pdf_generator.py — Jinja2 + WeasyPrint PDF report generator
Produces a clean, branded one-page PDF report of the AEO diagnostic.
"""

import os
from datetime import datetime
from jinja2 import Environment, BaseLoader

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #e2e8f0; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #7c3aed; }
  .logo { font-size: 28px; font-weight: 900; background: linear-gradient(135deg, #7c3aed, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .badge { background: linear-gradient(135deg, #7c3aed, #06b6d4); color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
  .query-box { background: #1a1a2e; border: 1px solid #7c3aed; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; }
  .query-box label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #7c3aed; }
  .query-box p { font-size: 18px; font-weight: 600; margin-top: 4px; }
  .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7c3aed; margin-bottom: 14px; }
  .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
  .score-card { background: #1a1a2e; border-radius: 12px; padding: 18px; text-align: center; border: 1px solid #2d2d4e; }
  .score-card .engine { font-size: 11px; color: #94a3b8; margin-bottom: 6px; text-transform: uppercase; }
  .score-card .score { font-size: 36px; font-weight: 900; }
  .score-card .status { font-size: 11px; margin-top: 4px; }
  .green { color: #22c55e; }
  .amber { color: #f59e0b; }
  .red { color: #ef4444; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 28px; background: #1a1a2e; border-radius: 12px; overflow: hidden; }
  th { background: #7c3aed; color: white; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; text-align: left; }
  td { padding: 10px 14px; border-bottom: 1px solid #2d2d4e; font-size: 13px; }
  .rank-badge { background: #7c3aed; color: white; border-radius: 6px; padding: 2px 8px; font-weight: 700; font-size: 12px; }
  .gap-card { background: #1a1a2e; border-radius: 10px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #ef4444; }
  .gap-card.medium { border-left-color: #f59e0b; }
  .gap-card.low { border-left-color: #22c55e; }
  .gap-title { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  .gap-action { font-size: 12px; color: #94a3b8; }
  .gap-action strong { color: #06b6d4; }
  .verdict-box { background: linear-gradient(135deg, #7c3aed22, #06b6d422); border: 1px solid #7c3aed; border-radius: 12px; padding: 18px 20px; margin-bottom: 28px; }
  .footer { text-align: center; font-size: 11px; color: #475569; margin-top: 32px; padding-top: 16px; border-top: 1px solid #2d2d4e; }
  .quick-win { background: #06b6d420; border: 1px solid #06b6d4; border-radius: 10px; padding: 14px 18px; margin-bottom: 28px; }
  .quick-win label { font-size: 11px; color: #06b6d4; text-transform: uppercase; letter-spacing: 1px; }
  .quick-win p { font-size: 14px; font-weight: 600; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Nexus AEO</div>
      <div style="font-size:12px; color:#94a3b8; margin-top:4px;">AEO Diagnostic Report</div>
    </div>
    <div>
      <div class="badge">AI Visibility Report Card</div>
      <div style="font-size:11px; color:#94a3b8; margin-top:6px; text-align:right;">Generated {{ date }}</div>
    </div>
  </div>

  <div class="query-box">
    <label>Shopper Query Analysed</label>
    <p>"{{ query }}"</p>
    {% if user_brand %}
    <div style="margin-top: 10px; font-size: 12px; color: #94a3b8;">Brand being tracked: <strong style="color:#7c3aed;">{{ user_brand }}</strong></div>
    {% endif %}
  </div>

  {% if user_brand and user_result %}
  <div class="section-title">Your AI Visibility Score</div>
  <div class="score-grid">
    {% for engine, data in user_result.breakdown.items() %}
    <div class="score-card">
      <div class="engine">{{ engine }}</div>
      <div class="score {{ 'green' if data.score > 30 else ('amber' if data.score > 10 else 'red') }}">{{ data.score }}</div>
      <div class="status {{ 'green' if data.mentioned else 'red' }}">
        {{ '✓ Mentioned' if data.mentioned else '✗ Not found' }}
      </div>
    </div>
    {% endfor %}
  </div>

  {% if gap_analysis %}
  <div class="verdict-box">
    <div class="section-title" style="margin-bottom:8px;">Overall Verdict</div>
    <p style="font-size:15px; font-weight:600;">{{ gap_analysis.overall_verdict }}</p>
  </div>

  {% if gap_analysis.quick_win %}
  <div class="quick-win">
    <label>⚡ Quick Win — Highest-Impact Action</label>
    <p>{{ gap_analysis.quick_win }}</p>
  </div>
  {% endif %}

  <div class="section-title">Gap Analysis — Specific Improvements</div>
  {% for gap in gap_analysis.gaps %}
  <div class="gap-card {{ gap.priority }}">
    <div class="gap-title">{{ gap.gap }}</div>
    <div class="gap-action"><strong>Action:</strong> {{ gap.action }}</div>
    <div style="margin-top:6px; font-size:11px; color:#64748b;">Impact: {{ gap.impact }} | Priority: <strong>{{ gap.priority|upper }}</strong></div>
  </div>
  {% endfor %}
  {% endif %}
  {% endif %}

  <div class="section-title" style="margin-top: 24px;">AI Visibility Leaderboard</div>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Brand / Product</th>
        <th>Score</th>
        <th>AIs</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {% for brand in leaderboard[:15] %}
      <tr>
        <td><span class="rank-badge">#{{ brand.rank }}</span></td>
        <td style="font-weight:{{ '700' if brand.brand|lower == user_brand|lower else '400' }}; color: {{ '#7c3aed' if brand.brand|lower == user_brand|lower else 'inherit' }}">
          {{ brand.brand }}{% if brand.brand|lower == user_brand|lower %} ← YOU{% endif %}
        </td>
        <td class="{{ brand.rag_status }}"><strong>{{ brand.total_score }}</strong>/100</td>
        <td>{{ brand.ais_mentioned_in }}/3</td>
        <td class="{{ brand.rag_status }}">{{ '●' * brand.ais_mentioned_in }}{{ '○' * (3 - brand.ais_mentioned_in) }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="footer">
    <strong>Nexus AEO</strong> — The AI intelligence layer for e-commerce brands<br>
    Report generated {{ date }} · AEO Diagnostic v1.0 · Powered by GPT-4o, Claude Sonnet & Gemini 1.5 Pro
  </div>
</body>
</html>
"""


def generate_pdf_bytes(report: dict) -> bytes:
    """Render report dict to PDF bytes using WeasyPrint."""
    try:
        from weasyprint import HTML
    except ImportError:
        raise RuntimeError("WeasyPrint not installed. Run: pip install weasyprint")

    env = Environment(loader=BaseLoader())
    template = env.from_string(HTML_TEMPLATE)

    user_brand = report.get("user_brand", "")
    leaderboard = report.get("leaderboard", [])
    user_result = next(
        (b for b in leaderboard if b["brand"].lower() == user_brand.lower()), None
    )

    html_str = template.render(
        query=report.get("query", ""),
        user_brand=user_brand,
        leaderboard=leaderboard,
        user_result=user_result,
        gap_analysis=report.get("gap_analysis"),
        date=datetime.now().strftime("%d %B %Y, %H:%M"),
    )

    return HTML(string=html_str).write_pdf()
