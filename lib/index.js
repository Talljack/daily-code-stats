"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
module.exports = __toCommonJS(src_exports);
var import_moment = __toESM(require("moment"));
var import_fs = __toESM(require("fs"));
var import_core = require("@actions/core");
var import_github = require("@actions/github");
var Generator = class {
  token;
  owner;
  dailyCodeInfo;
  dailyCodeChange = {
    additions: 0,
    deletions: 0
  };
  constructor() {
    let user = import_github.context.actor;
    if (!user)
      (0, import_core.setFailed)("owner name does not exist!");
    this.owner = user;
    const token = (0, import_core.getInput)("token");
    if (!token)
      (0, import_core.setFailed)("token does not exist!");
    this.token = token;
    this.dailyCodeInfo = {
      username: this.owner,
      dailyCodeChanges: {}
    };
  }
  async getUserDailyCodeInfo() {
    const octokit = (0, import_github.getOctokit)(this.token);
    const currentDate = (0, import_moment.default)().format("YYYY-MM-DD");
    const username = this.owner;
    const startDate = (0, import_moment.default)().subtract(1, "days").format("YYYY-MM-DD");
    const endDate = (0, import_moment.default)().subtract(1, "days").format("YYYY-MM-DD");
    let dailyCodeChanges = {
      [currentDate]: { additions: 0, deletions: 0 }
    };
    try {
      let page = 1;
      let keepGoing = true;
      while (keepGoing) {
        const response = await octokit.request("GET /users/{username}/events", {
          username,
          page
        });
        for (let event of response.data) {
          if (event.type === "PushEvent") {
            let eventDate = (0, import_moment.default)(event.created_at);
            if (eventDate.isBetween(startDate, endDate, "day", "[]")) {
              const dateStr = eventDate.format("YYYY-MM-DD");
              for (let commit of event.payload.commits) {
                const commitData = await octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
                  owner: event.repo.name.split("/")[0],
                  repo: event.repo.name.split("/")[1],
                  ref: commit.sha
                });
                const stats = commitData.data.stats;
                if (!dailyCodeChanges?.[dateStr]) {
                  dailyCodeChanges[dateStr] = { additions: 0, deletions: 0 };
                }
                dailyCodeChanges[dateStr].additions += stats?.additions ?? 0;
                dailyCodeChanges[dateStr].deletions += stats?.deletions ?? 0;
              }
            } else if (eventDate.isBefore(startDate)) {
              keepGoing = false;
              break;
            }
          }
        }
        if (response.data.length === 0 || !keepGoing) {
          break;
        }
        page++;
      }
      return { username, dailyCodeChanges };
    } catch (error) {
      console.error(`Error fetching commits for ${username}:`, error);
      return { username, dailyCodeChanges };
    }
  }
  // 更新 README.md 的函数
  async updateReadme(dailyCodeInfo) {
    const readmePath = "README.md";
    let readmeContent = "";
    if (import_fs.default.existsSync(readmePath)) {
      readmeContent = await import_fs.default.promises.readFile(readmePath, "utf8");
    }
    let statsContent = `## ${dailyCodeInfo.username} Daily Code Statistics

`;
    statsContent += "| Date       | Addition Codes | Deletion Codes |\n";
    statsContent += "|------------|-----------|-----------|\n";
    Object.entries(dailyCodeInfo.dailyCodeChanges).forEach(([date, stats]) => {
      statsContent += `| ${date} | ${stats.additions} | ${stats.deletions} |
`;
    });
    const startMarker = "<!-- START_STATS -->";
    const endMarker = "<!-- END_STATS -->";
    const start = readmeContent.indexOf(startMarker);
    const end = readmeContent.indexOf(endMarker);
    if (start !== -1 && end !== -1) {
      readmeContent = readmeContent.substring(0, start + startMarker.length) + "\n\n" + statsContent + "\n" + readmeContent.substring(end);
    } else {
      readmeContent += "\n" + startMarker + "\n\n" + statsContent + "\n" + endMarker;
    }
    await import_fs.default.promises.writeFile(readmePath, readmeContent, "utf8");
  }
};
async function main() {
  const generator = new Generator();
  const dailyCodeInfo = await generator.getUserDailyCodeInfo();
  (0, import_core.setOutput)("dailyCodeInfo", JSON.stringify(dailyCodeInfo));
  generator.updateReadme(dailyCodeInfo);
}
try {
  main();
} catch (error) {
  (0, import_core.setFailed)(`${error.message} -> ${error}`);
}
