const childProcess = require("node:child_process");
const { syncBuiltinESMExports } = require("node:module");

const originalExec = childProcess.exec;

function createStubChildProcess() {
  return {
    pid: undefined,
    stdin: null,
    stdout: null,
    stderr: null,
    kill() {
      return false;
    },
    on() {
      return this;
    },
    once() {
      return this;
    },
    removeListener() {
      return this;
    },
    unref() {
      return this;
    },
    ref() {
      return this;
    },
  };
}

childProcess.exec = function patchedExec(command, options, callback) {
  let resolvedCallback = callback;
  if (typeof options === "function") {
    resolvedCallback = options;
  }

  if (typeof command === "string" && command.trim().toLowerCase() === "net use") {
    const error = Object.assign(new Error("Blocked by sandbox"), { code: "EPERM" });
    if (typeof resolvedCallback === "function") {
      process.nextTick(() => resolvedCallback(error, "", ""));
    }

    return createStubChildProcess();
  }

  return originalExec.call(this, command, options, callback);
};

syncBuiltinESMExports();
