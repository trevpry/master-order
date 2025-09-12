#!/usr/bin/env node

/**
 * Post-Deployment Validation Script
 * Tests History Plus functionality after PostgreSQL deployment
 */

const http = require('http');
const https = require('https');

class DeploymentValidator {
  constructor(baseUrl = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
    this.results = [];
  }

  log(message, type = 'info') {
    const prefix = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} ${message}`);
    this.results.push({ message, type });
  }

  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`;
      const client = url.startsWith('https') ? https : http;
      
      const req = client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  async testHealthEndpoint() {
    this.log('Testing application health...');
    
    try {
      const response = await this.makeRequest('/health');
      if (response.status === 200) {
        this.log('Application health check passed', 'success');
        return true;
      } else {
        this.log(`Health check failed: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'error');
      return false;
    }
  }

  async testHistoryPlusAPI() {
    this.log('Testing History Plus API endpoints...');
    
    const endpoints = [
      '/api/history-plus/events',
      '/api/history-plus/videos', 
      '/api/history-plus/books',
      '/api/history-plus/channels'
    ];
    
    let passed = 0;
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint);
        if (response.status === 200) {
          this.log(`${endpoint} - OK (${Array.isArray(response.data) ? response.data.length + ' items' : 'response received'})`, 'success');
          passed++;
        } else {
          this.log(`${endpoint} - Failed: ${response.status}`, 'error');
        }
      } catch (error) {
        this.log(`${endpoint} - Error: ${error.message}`, 'error');
      }
    }
    
    return passed === endpoints.length;
  }

  async testUpNextIntegration() {
    this.log('Testing Up Next History Plus integration...');
    
    try {
      const response = await this.makeRequest('/api/up-next');
      if (response.status === 200) {
        const upNext = response.data;
        if (upNext && (upNext.type === 'HISTORY_PLUS_CONTENT' || upNext.episodeId || upNext.movieId)) {
          this.log('Up Next integration working', 'success');
          if (upNext.type === 'HISTORY_PLUS_CONTENT') {
            this.log('History Plus content found in Up Next', 'success');
          }
          return true;
        } else {
          this.log('Up Next response structure unexpected', 'warning');
          return false;
        }
      } else {
        this.log(`Up Next failed: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Up Next error: ${error.message}`, 'error');
      return false;
    }
  }

  async testAndroidAPI() {
    this.log('Testing Android API endpoints...');
    
    const endpoints = [
      '/api/android/up-next',
      '/api/android/settings'
    ];
    
    let passed = 0;
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint);
        if (response.status === 200) {
          this.log(`${endpoint} - OK`, 'success');
          passed++;
        } else {
          this.log(`${endpoint} - Failed: ${response.status}`, 'error');
        }
      } catch (error) {
        this.log(`${endpoint} - Error: ${error.message}`, 'error');
      }
    }
    
    return passed === endpoints.length;
  }

  async testDatabase() {
    this.log('Testing database connectivity...');
    
    try {
      // Test a simple API call that requires database
      const response = await this.makeRequest('/api/settings');
      if (response.status === 200) {
        this.log('Database connectivity confirmed', 'success');
        return true;
      } else {
        this.log(`Database test failed: ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Database error: ${error.message}`, 'error');
      return false;
    }
  }

  generateReport() {
    const successCount = this.results.filter(r => r.type === 'success').length;
    const errorCount = this.results.filter(r => r.type === 'error').length;
    const warningCount = this.results.filter(r => r.type === 'warning').length;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEPLOYMENT VALIDATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`⚠️  Warnings: ${warningCount}`);
    console.log('='.repeat(60));
    
    if (errorCount === 0) {
      this.log('🎉 DEPLOYMENT VALIDATION SUCCESSFUL!', 'success');
      this.log('All History Plus functionality is working correctly.', 'success');
      return true;
    } else {
      this.log('💥 DEPLOYMENT VALIDATION FAILED!', 'error');
      this.log(`${errorCount} critical issues found. Check logs above.`, 'error');
      return false;
    }
  }

  async runValidation() {
    this.log(`🚀 Starting deployment validation for ${this.baseUrl}...`);
    
    const tests = [
      () => this.testHealthEndpoint(),
      () => this.testDatabase(),
      () => this.testHistoryPlusAPI(),
      () => this.testUpNextIntegration(),
      () => this.testAndroidAPI()
    ];
    
    for (const test of tests) {
      await test();
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return this.generateReport();
  }
}

// Execute if run directly
if (require.main === module) {
  const baseUrl = process.argv[2] || 'http://localhost:3001';
  const validator = new DeploymentValidator(baseUrl);
  
  validator.runValidation().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Validation failed:', error.message);
    process.exit(1);
  });
}

module.exports = DeploymentValidator;