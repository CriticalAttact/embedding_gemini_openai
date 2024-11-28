const { spawn } = require('child_process');

// Function to run Python script and return a Promise
function runPythonScript(parameters) {
  return new Promise((resolve, reject) => {
    // Spawn the Python process
    const pythonProcess = spawn('python', ['utils/script.py', ...parameters]);

    let output = '';
    let error = '';

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    // Collect error data from stderr
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    // Handle process exit
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output.trim()); // Resolve with output on success
      } else {
        reject(new Error(`Python process exited with code ${code}: ${error.trim()}`));
      }
    });
  });
}

// Async function to run the Python script and handle the result
async function marco_embedding(texts) {
  try {
    const parameters = texts; // Define parameters
    let result = await runPythonScript(parameters); // Await the Python script result
    return JSON.parse(result)
  } catch (error) {
    console.error(`Error: ${error.message}`);
    return false;
  }
}

// Run the async function
module.exports = {
    marco_embedding
};