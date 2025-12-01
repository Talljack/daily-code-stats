import moment from 'moment';
import fs from 'fs';
import { getInput, setFailed, setOutput } from '@actions/core';
import { getOctokit, context } from '@actions/github';
import { Endpoints } from '@octokit/types';

type PushEvent =
  Endpoints['GET /users/{username}/events']['response']['data'][0];

export type DailyCodeChange = {
  additions: number;
  deletions: number;
};

export type DailyCodeInfo = {
  username: string;
  dailyCodeChanges: Record<string, DailyCodeChange>;
};

const getUserInputs = () => {
  const additionCodeLabel = getInput('additionCodeLabel');
  const deletionCodeLabel = getInput('deletionCodeLabel');
  // Get timezone offset in hours (default: +8 for Beijing/Shanghai)
  const timezoneOffset = parseInt(getInput('timezoneOffset') || '8', 10);
  // Calculate the current date in the specified timezone
  const now = moment().utcOffset(timezoneOffset * 60);
  // Default to yesterday in the specified timezone
  const defaultDate = now.clone().subtract(1, 'days').format('YYYY-MM-DD');
  const startDate = getInput('startDate') || defaultDate;
  const endDate = getInput('endDate') || defaultDate;
  console.log(
    `Timezone offset: UTC+${timezoneOffset}, Current time: ${now.format('YYYY-MM-DD HH:mm:ss')}, Target date: ${defaultDate}`,
  );
  return {
    additionCodeLabel,
    deletionCodeLabel,
    startDate,
    endDate,
    timezoneOffset,
  };
};

class Generator {
  token: string;
  owner: string;

  userOptions: ReturnType<typeof getUserInputs>;

  dailyCodeInfo: DailyCodeInfo;

  dailyCodeChange: DailyCodeChange = {
    additions: 0,
    deletions: 0,
  };
  constructor() {
    const user = context.actor;
    if (!user) setFailed('owner name does not exist!');
    this.owner = user;
    const token = getInput('token');
    console.log('token', token);
    if (!token) setFailed('token does not exist!');
    this.token = token;
    this.dailyCodeInfo = {
      username: this.owner,
      dailyCodeChanges: {},
    };
    this.userOptions = getUserInputs();
  }

  async getUserDailyCodeInfo() {
    const octokit = getOctokit(this.token);
    const username = this.owner;
    const startDate = this.userOptions.startDate;
    const endDate = this.userOptions.endDate;
    // Initialize with the target date range
    const dailyCodeChanges = {
      [startDate]: { additions: 0, deletions: 0 },
    } as DailyCodeInfo['dailyCodeChanges'];
    try {
      let page = 1;
      let keepGoing = true;
      while (keepGoing) {
        const response = await octokit.request('GET /users/{username}/events', {
          username,
          page,
        });
        for (const event of response.data as PushEvent[]) {
          if (event.type === 'PushEvent') {
            const eventDate = moment(event.created_at);
            if (eventDate.isBetween(startDate, endDate, 'day', '[]')) {
              const dateStr = eventDate.format('YYYY-MM-DD');
              // @ts-ignore
              const payload = event.payload;
              const repoOwner = event.repo.name.split('/')[0];
              const repoName = event.repo.name.split('/')[1];

              // Try to get commits from payload first, otherwise use compare API
              // @ts-ignore
              let commits = payload?.commits as
                | Array<{ sha: string }>
                | undefined;

              // If commits not in payload, try to get from compare API using head and before
              if (!Array.isArray(commits) || commits.length === 0) {
                // @ts-ignore
                const head = payload?.head;
                // @ts-ignore
                const before = payload?.before;

                if (head && before) {
                  try {
                    // Use compare API to get commits between before and head
                    const compareData = await octokit.request(
                      'GET /repos/{owner}/{repo}/compare/{basehead}',
                      {
                        owner: repoOwner,
                        repo: repoName,
                        basehead: `${before}...${head}`,
                      },
                    );
                    commits = compareData.data.commits || [];
                    console.log(
                      `Found ${commits.length} commits via compare API for ${event.repo.name}`,
                    );
                  } catch (compareError) {
                    console.warn(
                      `Failed to compare commits for ${event.repo.name}:`,
                      compareError,
                    );
                    continue;
                  }
                } else {
                  continue;
                }
              }

              for (const commit of commits) {
                try {
                  // @ts-ignore
                  const sha: string =
                    typeof commit === 'string' ? commit : commit.sha;
                  const commitData = await octokit.request(
                    'GET /repos/{owner}/{repo}/commits/{ref}',
                    {
                      owner: repoOwner,
                      repo: repoName,
                      ref: sha,
                    },
                  );
                  const stats = commitData.data.stats;
                  if (!dailyCodeChanges?.[dateStr]) {
                    dailyCodeChanges[dateStr] = { additions: 0, deletions: 0 };
                  }
                  dailyCodeChanges[dateStr].additions += stats?.additions ?? 0;
                  dailyCodeChanges[dateStr].deletions += stats?.deletions ?? 0;
                } catch (commitError) {
                  // @ts-ignore
                  const commitId =
                    typeof commit === 'string' ? commit : commit.sha;
                  console.warn(
                    `Failed to fetch commit ${commitId}:`,
                    commitError,
                  );
                }
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
  async updateReadme(dailyCodeInfo: {
    username: string;
    dailyCodeChanges: Record<string, { additions: number; deletions: number }>;
  }) {
    const readmePath = 'README.md';
    let readmeContent = '';

    // 尝试读取现有的 README.md 内容
    if (fs.existsSync(readmePath)) {
      readmeContent = await fs.promises.readFile(readmePath, 'utf8');
    }
    // 构建新的统计数据部分
    let statsContent = `## ${dailyCodeInfo.username} Daily Code Statistics\n\n`;
    statsContent += `| Date       | ${this.userOptions.additionCodeLabel} | ${this.userOptions.deletionCodeLabel} |\n`;
    statsContent += '|------------|-----------|-----------|\n';

    Object.entries(dailyCodeInfo.dailyCodeChanges).forEach(([date, stats]) => {
      statsContent += `| ${date} | ${stats.additions} | ${stats.deletions} |\n`;
    });

    // 标记统计数据的开始和结束
    const startMarker = '<!-- START_STATS -->';
    const endMarker = '<!-- END_STATS -->';

    // 替换旧的统计数据
    const start = readmeContent.indexOf(startMarker);
    const end = readmeContent.indexOf(endMarker);
    console.log('statsContent', statsContent);
    if (start !== -1 && end !== -1) {
      readmeContent =
        readmeContent.substring(0, start + startMarker.length) +
        '\n\n' +
        statsContent +
        '\n' +
        readmeContent.substring(end);
    } else {
      // 如果未找到标记，则在文件末尾追加统计数据
      readmeContent +=
        '\n' + startMarker + '\n\n' + statsContent + '\n' + endMarker;
    }
    // 写入更新后的内容
    await fs.promises.writeFile(readmePath, readmeContent, 'utf8');
  }
}

// 主函数
async function main() {
  const generator = new Generator();
  const dailyCodeInfo = await generator.getUserDailyCodeInfo();
  console.log('dailyCodeInfo', dailyCodeInfo);
  setOutput('dailyCodeInfo', JSON.stringify(dailyCodeInfo));
  // 格式化输出并更新 README.md
  generator.updateReadme(dailyCodeInfo);
}
try {
  main();
} catch (error) {
  setFailed(`${(error as unknown as { message: string }).message} -> ${error}`);
}
