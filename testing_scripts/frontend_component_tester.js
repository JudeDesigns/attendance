/**
 * WorkSync Frontend Component Testing Script
 * Automated testing of React components and user interactions
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class WorkSyncFrontendTester {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.browser = null;
        this.page = null;
        this.testResults = [];
        this.screenshots = [];
    }

    async initialize() {
        console.log('Initializing browser...');
        this.browser = await puppeteer.launch({
            headless: false, // Set to true for headless testing
            defaultViewport: { width: 1280, height: 720 },
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Enable console logging
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('❌ Console Error:', msg.text());
            }
        });
        
        // Enable request/response logging
        this.page.on('response', response => {
            if (response.status() >= 400) {
                console.log(`❌ HTTP Error: ${response.status()} ${response.url()}`);
            }
        });
    }

    async logTest(testName, status, details = '', screenshot = false) {
        const result = {
            test_name: testName,
            status: status,
            details: details,
            timestamp: new Date().toISOString(),
            url: this.page.url()
        };
        
        if (screenshot) {
            const screenshotPath = `screenshots/${testName.replace(/\s+/g, '_')}_${Date.now()}.png`;
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            result.screenshot = screenshotPath;
            this.screenshots.push(screenshotPath);
        }
        
        this.testResults.push(result);
        
        const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
        const reset = '\x1b[0m';
        console.log(`${color}[${status}]${reset} ${testName}`);
        if (details) {
            console.log(`    ${details}`);
        }
    }

    async waitForElement(selector, timeout = 5000) {
        try {
            await this.page.waitForSelector(selector, { timeout });
            return true;
        } catch (error) {
            return false;
        }
    }

    async testLoginPage() {
        console.log('\n=== Testing Login Page ===');
        
        try {
            await this.page.goto(`${this.baseUrl}/login`);
            
            // Check if login form elements exist
            const usernameField = await this.waitForElement('input[name="username"], input[type="text"]');
            const passwordField = await this.waitForElement('input[name="password"], input[type="password"]');
            const loginButton = await this.waitForElement('button[type="submit"], button:contains("Login")');
            
            if (usernameField && passwordField && loginButton) {
                await this.logTest('Login form elements', 'PASS', 'All required form elements present');
            } else {
                await this.logTest('Login form elements', 'FAIL', 
                    `Missing elements: username=${usernameField}, password=${passwordField}, button=${loginButton}`, true);
            }
            
            // Test form validation
            const submitButton = await this.page.$('button[type="submit"]');
            if (submitButton) {
                await submitButton.click();
                await this.page.waitForTimeout(1000);
                
                // Check for validation messages
                const errorMessages = await this.page.$$eval('[class*="error"], .text-red-500, .text-danger', 
                    elements => elements.map(el => el.textContent));
                
                if (errorMessages.length > 0) {
                    await this.logTest('Login form validation', 'PASS', 
                        `Validation messages displayed: ${errorMessages.join(', ')}`);
                } else {
                    await this.logTest('Login form validation', 'FAIL', 
                        'No validation messages shown for empty form');
                }
            }
            
            // Test login with test credentials
            await this.testLogin('admin', 'admin123');
            
        } catch (error) {
            await this.logTest('Login page test', 'ERROR', error.message, true);
        }
    }

    async testLogin(username, password) {
        try {
            // Fill login form
            await this.page.type('input[name="username"], input[type="text"]', username);
            await this.page.type('input[name="password"], input[type="password"]', password);
            
            // Submit form
            await this.page.click('button[type="submit"]');
            
            // Wait for navigation or error message
            await Promise.race([
                this.page.waitForNavigation({ timeout: 5000 }),
                this.page.waitForSelector('[class*="error"], .text-red-500', { timeout: 5000 })
            ]);
            
            // Check if redirected to dashboard
            const currentUrl = this.page.url();
            if (currentUrl.includes('/dashboard') || currentUrl === `${this.baseUrl}/`) {
                await this.logTest(`Login with ${username}`, 'PASS', 'Successfully logged in and redirected');
                return true;
            } else {
                const errorMessage = await this.page.$eval('[class*="error"], .text-red-500', 
                    el => el.textContent).catch(() => 'Unknown error');
                await this.logTest(`Login with ${username}`, 'FAIL', `Login failed: ${errorMessage}`);
                return false;
            }
            
        } catch (error) {
            await this.logTest(`Login with ${username}`, 'ERROR', error.message);
            return false;
        }
    }

    async testDashboard() {
        console.log('\n=== Testing Dashboard ===');
        
        try {
            // Navigate to dashboard if not already there
            if (!this.page.url().includes('/dashboard') && this.page.url() !== `${this.baseUrl}/`) {
                await this.page.goto(`${this.baseUrl}/`);
            }
            
            // Wait for dashboard to load
            await this.page.waitForTimeout(2000);
            
            // Check for key dashboard elements
            const elements = {
                'Clock In/Out Button': 'button:contains("Clock In"), button:contains("Clock Out"), [class*="clock"]',
                'Navigation Menu': 'nav, [class*="nav"], .sidebar, [class*="menu"]',
                'User Info': '[class*="user"], [class*="profile"], .user-info',
                'Dashboard Stats': '[class*="stat"], [class*="card"], .dashboard-card'
            };
            
            for (const [elementName, selector] of Object.entries(elements)) {
                const exists = await this.page.$(selector) !== null;
                if (exists) {
                    await this.logTest(`Dashboard ${elementName}`, 'PASS', 'Element found on dashboard');
                } else {
                    await this.logTest(`Dashboard ${elementName}`, 'FAIL', 'Element not found on dashboard');
                }
            }
            
            // Test responsive design
            await this.testResponsiveDesign();
            
        } catch (error) {
            await this.logTest('Dashboard test', 'ERROR', error.message, true);
        }
    }

    async testResponsiveDesign() {
        console.log('\n=== Testing Responsive Design ===');
        
        const viewports = [
            { name: 'Mobile', width: 375, height: 667 },
            { name: 'Tablet', width: 768, height: 1024 },
            { name: 'Desktop', width: 1280, height: 720 }
        ];
        
        for (const viewport of viewports) {
            try {
                await this.page.setViewport(viewport);
                await this.page.waitForTimeout(1000);
                
                // Check if mobile menu is visible on small screens
                if (viewport.width < 768) {
                    const mobileMenu = await this.page.$('[class*="hamburger"], [class*="mobile-menu"], .menu-toggle');
                    if (mobileMenu) {
                        await this.logTest(`${viewport.name} navigation`, 'PASS', 'Mobile menu found');
                    } else {
                        await this.logTest(`${viewport.name} navigation`, 'FAIL', 'Mobile menu not found');
                    }
                }
                
                // Check for layout issues
                const hasHorizontalScroll = await this.page.evaluate(() => {
                    return document.body.scrollWidth > window.innerWidth;
                });
                
                if (!hasHorizontalScroll) {
                    await this.logTest(`${viewport.name} layout`, 'PASS', 'No horizontal scroll');
                } else {
                    await this.logTest(`${viewport.name} layout`, 'FAIL', 'Horizontal scroll detected', true);
                }
                
            } catch (error) {
                await this.logTest(`${viewport.name} responsive test`, 'ERROR', error.message);
            }
        }
        
        // Reset to default viewport
        await this.page.setViewport({ width: 1280, height: 720 });
    }

    async runAllTests() {
        console.log('Starting WorkSync Frontend Testing...');
        console.log(`Testing against: ${this.baseUrl}`);
        
        // Create screenshots directory
        if (!fs.existsSync('screenshots')) {
            fs.mkdirSync('screenshots');
        }
        
        const startTime = Date.now();
        
        try {
            await this.initialize();
            
            // Run test suites
            await this.testLoginPage();
            await this.testDashboard();
            
            await this.generateSummary(Date.now() - startTime);
            
        } catch (error) {
            console.error('Testing failed:', error);
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async generateSummary(totalTime) {
        console.log('\n' + '='.repeat(50));
        console.log('FRONTEND TEST SUMMARY');
        console.log('='.repeat(50));
        
        const total = this.testResults.length;
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const errors = this.testResults.filter(r => r.status === 'ERROR').length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log(`Errors: ${errors}`);
        console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`Screenshots: ${this.screenshots.length}`);
        
        // Save results
        const results = {
            summary: { total, passed, failed, errors, totalTime, timestamp: new Date().toISOString() },
            results: this.testResults,
            screenshots: this.screenshots
        };
        
        fs.writeFileSync('frontend_test_results.json', JSON.stringify(results, null, 2));
        console.log('\nDetailed results saved to: frontend_test_results.json');
        
        if (this.screenshots.length > 0) {
            console.log(`Screenshots saved to: screenshots/`);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const baseUrl = process.argv[2] || 'http://localhost:3000';
    const tester = new WorkSyncFrontendTester(baseUrl);
    tester.runAllTests().catch(console.error);
}

module.exports = WorkSyncFrontendTester;
