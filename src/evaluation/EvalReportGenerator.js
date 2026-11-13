/**
 * Gerador de Relatórios Executivos de Avaliação e Benchmark (EvalReportGenerator - v4.3).
 * Produz relatórios em Markdown formatado para PRs de CI/CD (GitHub/GitLab) e payloads em JSON.
 */
class EvalReportGenerator {
    /**
     * Gera relatório executivo em Markdown formatado.
     * @param {Object} suiteResults - Resultado da execução do harness.
     * @returns {string} Markdown pronto para publicação em CI/CD.
     */
    static generateMarkdown(suiteResults) {
        const {
            suiteName = 'Agent Regression Suite',
            totalScenarios = 0,
            passedScenarios = 0,
            failedScenarios = 0,
            passRate = 0,
            totalDurationMs = 0,
            averageTokenUsage = 0,
            scenarios = []
        } = suiteResults;

        const statusEmoji = passRate === 100 ? '🟢' : passRate >= 80 ? '🟡' : '🔴';

        let md = `## ${statusEmoji} Relatório de Avaliação de Trajetória: ${suiteName}\n\n`;
        md += `> **Data de Execução:** ${new Date().toISOString()} | **Duração Total:** ${totalDurationMs}ms\n\n`;

        // Sumário de KPIs
        md += `### 📊 Sumário Executivo\n\n`;
        md += `| Métrica | Valor | Status |\n`;
        md += `|---|---|---|\n`;
        md += `| **Taxa de Aprovação (Pass Rate)** | **${passRate}%** (${passedScenarios}/${totalScenarios}) | ${passRate >= 90 ? '✅ Aprovado' : '⚠️ Atenção'} |\n`;
        md += `| **Cenários com Sucesso** | ${passedScenarios} | — |\n`;
        md += `| **Cenários com Falha** | ${failedScenarios} | ${failedScenarios === 0 ? '✅ Zero' : '❌ Falhas detectadas'} |\n`;
        md += `| **Média de Tokens / Cenário** | ${averageTokenUsage} tokens | — |\n\n`;

        // Tabela Detalhada de Cenários
        md += `### 🧪 Detalhamento por Cenário\n\n`;
        md += `| Cenário | Status | Goal Score | Trajetória | Loops | Turnos | Duração |\n`;
        md += `|---|---|---|---|---|---|---|\n`;

        for (const s of scenarios) {
            const scStatus = s.passed ? '✅ PASS' : '❌ FAIL';
            const goalScore = s.metrics?.goalScore !== undefined ? `${Math.round(s.metrics.goalScore * 100)}%` : '—';
            const trajScore = s.metrics?.alignmentScore !== undefined ? s.metrics.alignmentScore.toFixed(2) : '1.00';
            const loopStatus = s.metrics?.hasLoop ? `⚠️ ${s.metrics.loopScore}` : '✅ 0.00';
            const turns = s.turns || 1;
            const dur = `${s.durationMs || 0}ms`;

            md += `| **${s.name || s.id}** | ${scStatus} | ${goalScore} | ${trajScore} | ${loopStatus} | ${turns} | ${dur} |\n`;
        }

        // Falhas detalhadas se houverem
        const failures = scenarios.filter((s) => !s.passed);
        if (failures.length > 0) {
            md += `\n### ⚠️ Inconformidades Identificadas\n\n`;
            for (const f of failures) {
                md += `- **${f.name || f.id}**:\n`;
                if (f.failures && f.failures.length > 0) {
                    for (const fail of f.failures) {
                        md += `  - ❌ ${fail}\n`;
                    }
                }
                if (f.metrics?.missingTools && f.metrics.missingTools.length > 0) {
                    md += `  - ⚠️ Ferramentas ausentes na trajetória: \`[${f.metrics.missingTools.join(', ')}]\`\n`;
                }
                if (f.metrics?.loopPatterns && f.metrics.loopPatterns.length > 0) {
                    for (const lp of f.metrics.loopPatterns) {
                        md += `  - 🔁 ${lp}\n`;
                    }
                }
            }
        }

        return md;
    }

    /**
     * Gera relatório serializável em JSON.
     * @param {Object} suiteResults
     * @returns {Object}
     */
    static generateJson(suiteResults) {
        return {
            timestamp: Date.now(),
            ...suiteResults
        };
    }
}

module.exports = EvalReportGenerator;

