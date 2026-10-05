

const axios = require('axios');
/**
 * GitHub PR Adapter
 * Posts findings directly to Pull Request comments.
 */
class GitHubProvider {
  constructor() {
    // We use environment variables for security in production
    this.token = process.env.GITHUB_TOKEN; 
    this.repoOwner = process.env.REPO_OWNER;
    this.repoName = process.env.REPO_NAME;
this.client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
  }
async postFinding(prNumber, finding) {
    const url = `/repos/${this.repoOwner}/${this.repoName}/issues/${prNumber}/comments`;
    const body = {
      body: `### 🤖 824 Enterprise Review Finding\n${finding.toMarkdown()}`
    };
try {
      const response = await this.client.post(url, body);
      console.log(`Successfully posted finding ${finding.id} to PR #${prNumber}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API Error:', error.response?.data?.message || error.message);
      throw error;
    }
  }
}
module.exports = GitHubProvider;


