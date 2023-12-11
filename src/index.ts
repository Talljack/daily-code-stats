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

const getUserInput = () => {
  const additionCodeColor = getInput('additionCodeColor');
  const deletionCodeColor = getInput('deletionCodeColor');
  const additionCodeLabel = getInput('additionCodeLabel');
  const deletionCodeLabel = getInput('deletionCodeLabel');
  const startDate = getInput('startDate') ?? moment().subtract(1, 'days').format('YYYY-MM-DD');
  const endDate = getInput('endDate') ?? moment().subtract(1, 'days').format('YYYY-MM-DD');
  return {
    additionCodeColor,
    deletionCodeColor,
    additionCodeLabel,
    deletionCodeLabel,
    startDate,
    endDate,
  };
}

class Generator {
  token: string;
  owner: string;

  userOptions = getUserInput();

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
  }

  async getUserDailyCodeInfo() {
    const octokit = getOctokit(this.token);
    const prevDate = moment().subtract(1, 'days').format('YYYY-MM-DD');
    const username = this.owner;
    const startDate = this.userOptions.startDate;
    const endDate = this.userOptions.endDate;
    const dailyCodeChanges = {
      [prevDate]: { additions: 0, deletions: 0 },
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
              for (const commit of event.payload.commits) {
                const commitData = await octokit.request(
                  'GET /repos/{owner}/{repo}/commits/{ref}',
                  {
                    owner: event.repo.name.split('/')[0],
                    repo: event.repo.name.split('/')[1],
                    ref: commit.sha,
                  },
                );
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
      statsContent += `| ${date} | <font color="${this.userOptions.additionCodeColor}">${stats.additions}</font> | <font color="${this.userOptions.deletionCodeColor}">${stats.deletions}</font> |\n`;
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
