#!/usr/bin/env node

/**
 * Post-release monitoring for @oxog/spark
 * Tracks npm downloads, GitHub issues, and community feedback
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

class PostReleaseMonitor {
  constructor() {
    this.packageName = '@oxog/spark';
    this.githubRepo = 'ersinkoc/spark';
    this.startTime = Date.now();
    this.metrics = {
      downloads: {},
      issues: [],
      stars: 0,
      forks: 0,
      vulnerabilities: [],
      feedback: []
    };
  }

  async monitor() {
    console.log('📊 Starting post-release monitoring for @oxog/spark\n');

    const tasks = [
      this.trackNpmDownloads(),
      this.monitorGitHubIssues(),
      this.checkSecurityAlerts(),
      this.analyzePerformanceReports(),
      this.collectUserFeedback(),
      this.monitorCommunityEngagement(),
      this.checkDocumentationUpdates()
    ];

    await Promise.all(tasks);
    this.generateReport();
  }

  async trackNpmDownloads() {
    console.log('📥 Tracking npm downloads...');
    
    try {
      // Get download stats for different periods
      const periods = ['last-day', 'last-week', 'last-month'];
      
      for (const period of periods) {
        const stats = await this.fetchNpmStats(period);
        this.metrics.downloads[period] = stats;
        console.log(`  ${period}: ${stats.downloads} downloads`);
      }

      // Get version-specific downloads
      const versionStats = await this.fetchNpmVersionStats();
      this.metrics.downloads.byVersion = versionStats;
      
      // Calculate growth rate
      if (this.metrics.downloads['last-week'] && this.metrics.downloads['last-month']) {
        const weeklyAvg = this.metrics.downloads['last-week'].downloads / 7;
        const monthlyAvg = this.metrics.downloads['last-month'].downloads / 30;
        const growthRate = ((weeklyAvg - monthlyAvg) / monthlyAvg * 100).toFixed(2);
        this.metrics.downloads.growthRate = growthRate + '%';
        console.log(`  Growth rate: ${growthRate}%`);
      }
    } catch (error) {
      console.error('  ❌ Failed to fetch npm stats:', error.message);
    }
  }

  async monitorGitHubIssues() {
    console.log('\n🐛 Monitoring GitHub issues...');
    
    try {
      const issues = await this.fetchGitHubIssues();
      
      // Categorize issues
      const categorized = {
        bugs: [],
        features: [],
        questions: [],
        security: [],
        performance: []
      };

      for (const issue of issues) {
        const labels = issue.labels.map(l => l.name.toLowerCase());
        
        if (labels.includes('bug')) {
          categorized.bugs.push(issue);
        } else if (labels.includes('enhancement') || labels.includes('feature')) {
          categorized.features.push(issue);
        } else if (labels.includes('question')) {
          categorized.questions.push(issue);
        } else if (labels.includes('security')) {
          categorized.security.push(issue);
        } else if (labels.includes('performance')) {
          categorized.performance.push(issue);
        }
      }

      this.metrics.issues = categorized;
      
      console.log(`  Total open issues: ${issues.length}`);
      console.log(`  🐛 Bugs: ${categorized.bugs.length}`);
      console.log(`  ✨ Features: ${categorized.features.length}`);
      console.log(`  ❓ Questions: ${categorized.questions.length}`);
      console.log(`  🔒 Security: ${categorized.security.length}`);
      console.log(`  ⚡ Performance: ${categorized.performance.length}`);

      // Check for critical issues
      const critical = issues.filter(i => 
        i.labels.some(l => l.name.toLowerCase() === 'critical') ||
        i.title.toLowerCase().includes('critical')
      );

      if (critical.length > 0) {
        console.log(`\n  ⚠️  ${critical.length} CRITICAL issues require immediate attention!`);
        critical.forEach(issue => {
          console.log(`     - #${issue.number}: ${issue.title}`);
        });
      }
    } catch (error) {
      console.error('  ❌ Failed to fetch GitHub issues:', error.message);
    }
  }

  async checkSecurityAlerts() {
    console.log('\n🔒 Checking security vulnerabilities...');
    
    try {
      // Check npm audit
      const { execSync } = require('child_process');
      try {
        execSync('npm audit --json', { encoding: 'utf8' });
        console.log('  ✅ No vulnerabilities found');
      } catch (auditError) {
        const output = auditError.stdout || auditError.toString();
        try {
          const audit = JSON.parse(output);
          const vulnCount = audit.metadata.vulnerabilities;
          
          if (vulnCount.total > 0) {
            console.log(`  ⚠️  Found ${vulnCount.total} vulnerabilities:`);
            console.log(`     Critical: ${vulnCount.critical}`);
            console.log(`     High: ${vulnCount.high}`);
            console.log(`     Moderate: ${vulnCount.moderate}`);
            console.log(`     Low: ${vulnCount.low}`);
            
            this.metrics.vulnerabilities = vulnCount;
          }
        } catch (e) {
          // Parsing failed
        }
      }

      // Check for security-related issues
      const securityIssues = this.metrics.issues.security || [];
      if (securityIssues.length > 0) {
        console.log(`\n  🚨 ${securityIssues.length} security-related issues reported`);
      }
    } catch (error) {
      console.error('  ❌ Security check failed:', error.message);
    }
  }

  async analyzePerformanceReports() {
    console.log('\n⚡ Analyzing performance metrics...');
    
    try {
      // Look for performance-related issues
      const perfIssues = this.metrics.issues.performance || [];
      
      if (perfIssues.length > 0) {
        console.log(`  📊 ${perfIssues.length} performance issues reported`);
        
        // Analyze common themes
        const themes = {};
        perfIssues.forEach(issue => {
          const title = issue.title.toLowerCase();
          if (title.includes('memory')) themes.memory = (themes.memory || 0) + 1;
          if (title.includes('speed') || title.includes('slow')) themes.speed = (themes.speed || 0) + 1;
          if (title.includes('cpu')) themes.cpu = (themes.cpu || 0) + 1;
        });

        Object.entries(themes).forEach(([theme, count]) => {
          console.log(`     ${theme}: ${count} issues`);
        });
      } else {
        console.log('  ✅ No performance issues reported');
      }

      // Check community benchmarks
      console.log('\n  📈 Community benchmarks:');
      console.log('     Monitor Twitter/Reddit for performance comparisons');
      console.log('     Check for blog posts about Spark performance');
    } catch (error) {
      console.error('  ❌ Performance analysis failed:', error.message);
    }
  }

  async collectUserFeedback() {
    console.log('\n💬 Collecting user feedback...');
    
    try {
      // Analyze issue sentiment
      const allIssues = Object.values(this.metrics.issues).flat();
      let positive = 0;
      let negative = 0;
      
      allIssues.forEach(issue => {
        const text = (issue.title + ' ' + issue.body).toLowerCase();
        
        // Simple sentiment analysis
        const positiveWords = ['great', 'awesome', 'love', 'excellent', 'perfect', 'thanks'];
        const negativeWords = ['bug', 'error', 'broken', 'fail', 'crash', 'slow'];
        
        const posScore = positiveWords.filter(w => text.includes(w)).length;
        const negScore = negativeWords.filter(w => text.includes(w)).length;
        
        if (posScore > negScore) positive++;
        else if (negScore > posScore) negative++;
      });

      console.log(`  😊 Positive feedback: ${positive}`);
      console.log(`  😟 Negative feedback: ${negative}`);
      console.log(`  😐 Neutral: ${allIssues.length - positive - negative}`);

      // Check for feature requests
      const featureRequests = this.metrics.issues.features || [];
      if (featureRequests.length > 0) {
        console.log(`\n  🚀 Top feature requests:`);
        featureRequests.slice(0, 5).forEach(issue => {
          console.log(`     - ${issue.title}`);
        });
      }
    } catch (error) {
      console.error('  ❌ Feedback collection failed:', error.message);
    }
  }

  async monitorCommunityEngagement() {
    console.log('\n🌟 Monitoring community engagement...');
    
    try {
      // Get repository stats
      const repoStats = await this.fetchGitHubRepoStats();
      
      this.metrics.stars = repoStats.stargazers_count;
      this.metrics.forks = repoStats.forks_count;
      this.metrics.watchers = repoStats.watchers_count;
      
      console.log(`  ⭐ Stars: ${this.metrics.stars}`);
      console.log(`  🍴 Forks: ${this.metrics.forks}`);
      console.log(`  👀 Watchers: ${this.metrics.watchers}`);

      // Calculate engagement rate
      const totalIssues = Object.values(this.metrics.issues).flat().length;
      const engagementRate = ((totalIssues + this.metrics.forks) / this.metrics.stars * 100).toFixed(2);
      console.log(`  📊 Engagement rate: ${engagementRate}%`);

      // Check for contributors
      const contributors = await this.fetchGitHubContributors();
      console.log(`  👥 Contributors: ${contributors.length}`);
    } catch (error) {
      console.error('  ❌ Community monitoring failed:', error.message);
    }
  }

  async checkDocumentationUpdates() {
    console.log('\n📚 Checking documentation needs...');
    
    try {
      // Check for documentation-related issues
      const allIssues = Object.values(this.metrics.issues).flat();
      const docIssues = allIssues.filter(issue => 
        issue.title.toLowerCase().includes('doc') ||
        issue.body.toLowerCase().includes('documentation') ||
        issue.labels.some(l => l.name.toLowerCase().includes('doc'))
      );

      if (docIssues.length > 0) {
        console.log(`  📝 ${docIssues.length} documentation issues found:`);
        docIssues.slice(0, 5).forEach(issue => {
          console.log(`     - #${issue.number}: ${issue.title}`);
        });
      } else {
        console.log('  ✅ No documentation issues reported');
      }

      // Check for common questions that might need docs
      const questions = this.metrics.issues.questions || [];
      const commonTopics = {};
      
      questions.forEach(issue => {
        const words = issue.title.toLowerCase().split(/\s+/);
        words.forEach(word => {
          if (word.length > 4) {
            commonTopics[word] = (commonTopics[word] || 0) + 1;
          }
        });
      });

      const topTopics = Object.entries(commonTopics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (topTopics.length > 0) {
        console.log('\n  🔍 Common question topics (consider adding to docs):');
        topTopics.forEach(([topic, count]) => {
          console.log(`     - ${topic} (${count} mentions)`);
        });
      }
    } catch (error) {
      console.error('  ❌ Documentation check failed:', error.message);
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('POST-RELEASE MONITORING REPORT');
    console.log('='.repeat(60));
    
    const reportPath = path.join(__dirname, `monitoring-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(this.metrics, null, 2));
    
    console.log(`\n📄 Full report saved to: ${reportPath}`);
    
    // Generate action items
    console.log('\n🎯 ACTION ITEMS:');
    
    let actionCount = 0;
    
    // Critical issues
    if (this.metrics.issues.security && this.metrics.issues.security.length > 0) {
      actionCount++;
      console.log(`${actionCount}. Address ${this.metrics.issues.security.length} security issues immediately`);
    }
    
    // Performance issues
    if (this.metrics.issues.performance && this.metrics.issues.performance.length > 0) {
      actionCount++;
      console.log(`${actionCount}. Investigate ${this.metrics.issues.performance.length} performance reports`);
    }
    
    // Documentation needs
    const docIssues = Object.values(this.metrics.issues).flat().filter(i => 
      i.title.toLowerCase().includes('doc')
    );
    if (docIssues.length > 3) {
      actionCount++;
      console.log(`${actionCount}. Update documentation based on ${docIssues.length} requests`);
    }
    
    // High bug count
    if (this.metrics.issues.bugs && this.metrics.issues.bugs.length > 5) {
      actionCount++;
      console.log(`${actionCount}. Prioritize fixing ${this.metrics.issues.bugs.length} reported bugs`);
    }
    
    if (actionCount === 0) {
      console.log('✅ No immediate actions required!');
    }
    
    console.log('\n' + '='.repeat(60));
  }

  // Helper methods for API calls
  
  async fetchNpmStats(period) {
    return new Promise((resolve, reject) => {
      const url = `https://api.npmjs.org/downloads/point/${period}/@oxog/spark`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async fetchNpmVersionStats() {
    // This would fetch version-specific download stats
    return { latest: 'v1.0.0', downloads: {} };
  }

  async fetchGitHubIssues() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.githubRepo}/issues?state=open&per_page=100`,
        headers: {
          'User-Agent': 'Spark-Monitor',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async fetchGitHubRepoStats() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.githubRepo}`,
        headers: {
          'User-Agent': 'Spark-Monitor',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async fetchGitHubContributors() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${this.githubRepo}/contributors`,
        headers: {
          'User-Agent': 'Spark-Monitor',
          'Accept': 'application/vnd.github.v3+json'
        }
      };
      
      https.get(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }
}

// Run monitoring if executed directly
if (require.main === module) {
  const monitor = new PostReleaseMonitor();
  monitor.monitor().catch(error => {
    console.error('Monitoring failed:', error);
    process.exit(1);
  });
}

module.exports = PostReleaseMonitor;