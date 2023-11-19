# Daily Codes

A Nodejs script to count your codes today, and it will update on your README.md

# Usage

```yml
name: Example Workflow
on:
  schedule:
    - cron: '0 0 * * *'  # 每天运行一次
jobs:
  run-my-action:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: Talljack/daily-code-stats@main
      with:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

   - name: Commit files
      id: commit-files
      run: |
        if [ -n "$(git status --porcelain README.md)" ]; then
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add README.md
          git commit -m "Update README.md"
          echo "hasChange=true" >> $GITHUB_OUTPUT
        else
          echo "No Changes"
        fi

    - name: Push changes
      uses: ad-m/github-push-action@master
      if: ${{ steps.commit-files.outputs.hasChange == 'true' }}
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        branch: ${{ github.ref }}

```
