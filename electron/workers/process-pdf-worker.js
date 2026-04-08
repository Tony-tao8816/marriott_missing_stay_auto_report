const { parentPort, workerData } = require('node:worker_threads');
const { processPdfWorkflow } = require('../../src/workflows/process-pdf');

async function main() {
  try {
    const result = await processPdfWorkflow({
      pdfPath: workerData?.pdfPath,
      outputRoot: workerData?.outputRoot
    });

    parentPort.postMessage({
      status: 'ok',
      result
    });
  } catch (error) {
    parentPort.postMessage({
      status: 'error',
      message: error?.message || 'Unknown error'
    });
  }
}

main();
