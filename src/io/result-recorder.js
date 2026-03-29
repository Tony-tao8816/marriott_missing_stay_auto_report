const fs = require('node:fs/promises');
const path = require('node:path');
const { artifactFile, ensureDir, timestampForFile } = require('../utils/paths');

async function createRunArtifacts(resultDir) {
  const runId = timestampForFile();
  const absoluteResultDir = path.resolve(resultDir);
  const runDir = path.join(absoluteResultDir, runId);

  await ensureDir(runDir);

  return {
    runId,
    runDir,
    resultsPath: artifactFile(runDir, 'results.jsonl'),
    summaryPath: artifactFile(runDir, 'summary.json')
  };
}

async function appendResult(resultsPath, result) {
  await fs.appendFile(resultsPath, `${JSON.stringify(result)}\n`, 'utf8');
}

async function writeSummary(summaryPath, summary) {
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}

module.exports = {
  appendResult,
  createRunArtifacts,
  writeSummary
};
