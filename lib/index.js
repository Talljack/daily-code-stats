"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var moment_1 = require("moment");
var fs_extra_1 = require("fs-extra");
var octokit_1 = require("octokit");
var octokit = new octokit_1.Octokit({
    auth: process.env.GITHUB_TOKEN,
});
// 获取用户在特定日期范围内的提交事件
function getUserCommits(username, startDate, endDate) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function () {
        var page, keepGoing, dailyCodeChanges, response, _i, _c, event_1, eventDate, dateStr, _d, _e, commit, commitData, stats, error_1;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 12, , 13]);
                    page = 1;
                    keepGoing = true;
                    dailyCodeChanges = {};
                    _f.label = 1;
                case 1:
                    if (!keepGoing) return [3 /*break*/, 11];
                    return [4 /*yield*/, octokit.request('GET /users/{username}/events', {
                            username: username,
                            page: page
                        })];
                case 2:
                    response = _f.sent();
                    _i = 0, _c = response.data;
                    _f.label = 3;
                case 3:
                    if (!(_i < _c.length)) return [3 /*break*/, 10];
                    event_1 = _c[_i];
                    if (!(event_1.type === "PushEvent")) return [3 /*break*/, 9];
                    eventDate = (0, moment_1.default)(event_1.created_at);
                    if (!eventDate.isBetween(startDate, endDate, "day", "[]")) return [3 /*break*/, 8];
                    dateStr = eventDate.format("YYYY-MM-DD");
                    _d = 0, _e = event_1.payload.commits;
                    _f.label = 4;
                case 4:
                    if (!(_d < _e.length)) return [3 /*break*/, 7];
                    commit = _e[_d];
                    return [4 /*yield*/, octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
                            owner: event_1.repo.name.split('/')[0],
                            repo: event_1.repo.name.split('/')[1],
                            ref: commit.sha
                        })];
                case 5:
                    commitData = _f.sent();
                    stats = commitData.data.stats;
                    if (!(dailyCodeChanges === null || dailyCodeChanges === void 0 ? void 0 : dailyCodeChanges[dateStr])) {
                        dailyCodeChanges[dateStr] = { additions: 0, deletions: 0 };
                    }
                    dailyCodeChanges[dateStr].additions += (_a = stats === null || stats === void 0 ? void 0 : stats.additions) !== null && _a !== void 0 ? _a : 0;
                    dailyCodeChanges[dateStr].deletions += (_b = stats === null || stats === void 0 ? void 0 : stats.deletions) !== null && _b !== void 0 ? _b : 0;
                    _f.label = 6;
                case 6:
                    _d++;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 9];
                case 8:
                    if (eventDate.isBefore(startDate)) {
                        keepGoing = false;
                        return [3 /*break*/, 10];
                    }
                    _f.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 3];
                case 10:
                    if (response.data.length === 0 || !keepGoing) {
                        return [3 /*break*/, 11];
                    }
                    page++;
                    return [3 /*break*/, 1];
                case 11: return [2 /*return*/, { username: username, dailyCodeChanges: dailyCodeChanges }];
                case 12:
                    error_1 = _f.sent();
                    console.error("Error fetching commits for ".concat(username, ":"), error_1);
                    return [2 /*return*/, { username: username, dailyCodeChanges: {} }];
                case 13: return [2 /*return*/];
            }
        });
    });
}
// 更新 README.md 的函数
function updateReadme(dailyCodeInfo) {
    return __awaiter(this, void 0, void 0, function () {
        var readmePath, readmeContent, statsContent, startMarker, endMarker, start, end;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    readmePath = "README.md";
                    readmeContent = "";
                    if (!fs_extra_1.default.existsSync(readmePath)) return [3 /*break*/, 2];
                    return [4 /*yield*/, fs_extra_1.default.readFile(readmePath, "utf8")];
                case 1:
                    readmeContent = _a.sent();
                    _a.label = 2;
                case 2:
                    console.log('readmeContent', readmeContent);
                    statsContent = "## ".concat(dailyCodeInfo.username, " Daily Code Statistics\n\n");
                    statsContent += "| Date       | Addition Codes | Deletion Codes |\n";
                    statsContent += "|------------|-----------|-----------|\n";
                    Object.entries(dailyCodeInfo.dailyCodeChanges).forEach(function (_a) {
                        var date = _a[0], stats = _a[1];
                        statsContent += "| ".concat(date, " | ").concat(stats.additions, " | ").concat(stats.deletions, " |\n");
                    });
                    startMarker = "<!-- START_STATS -->";
                    endMarker = "<!-- END_STATS -->";
                    start = readmeContent.indexOf(startMarker);
                    end = readmeContent.indexOf(endMarker);
                    if (start !== -1 && end !== -1) {
                        readmeContent =
                            readmeContent.substring(0, start + startMarker.length) +
                                "\n\n" +
                                statsContent +
                                "\n" +
                                readmeContent.substring(end);
                    }
                    else {
                        // 如果未找到标记，则在文件末尾追加统计数据
                        readmeContent +=
                            "\n" + startMarker + "\n\n" + statsContent + "\n" + endMarker;
                    }
                    // 写入更新后的内容
                    return [4 /*yield*/, fs_extra_1.default.writeFile(readmePath, readmeContent, "utf8")];
                case 3:
                    // 写入更新后的内容
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// 主函数
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var user, START_DATE, END_DATE, dailyCodeInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    user = process.env.GITHUB_ACTOR;
                    if (!user)
                        return [2 /*return*/];
                    START_DATE = (0, moment_1.default)().subtract(1, 'days').format('YYYY-MM-DD');
                    END_DATE = (0, moment_1.default)().subtract(1, 'days').format('YYYY-MM-DD');
                    return [4 /*yield*/, getUserCommits(user, START_DATE, END_DATE)];
                case 1:
                    dailyCodeInfo = _a.sent();
                    // 格式化输出并更新 README.md
                    updateReadme(dailyCodeInfo);
                    return [2 /*return*/];
            }
        });
    });
}
main();
