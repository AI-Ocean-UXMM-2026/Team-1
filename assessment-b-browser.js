/**
 * Assessment B: Browser Visualization for Pickup Flow
 * Detector Overlay Injection and Console Capture
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PAGES = [
  { url: 'http://localhost:3000/pickup', name: 'pickup' },
  { url: 'http://localhost:3000/pickup/details', name: 'pickup-details' },
  { url: 'http://localhost:3000/pickup/payment', name: 'pickup-payment' },
  { url: 'http://localhost:3000/pickup/review', name: 'pickup-review' }
];

const DETECTOR_OVERLAY_SCRIPT = `
// Detector Overlay Injection
(function() {
  console.log('[DETECTOR] Initializing overlay...');
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'detector-overlay';
  overlay.style.cssText = \`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 99999;
  \`;
  document.body.appendChild(overlay);
  
  // Detector analysis function
  function analyzeElement(el, violations = []) {
    const computedStyle = window.getComputedStyle(el);
    const borderRadius = computedStyle.borderRadius;
    const color = computedStyle.color;
    const fontSize = computedStyle.fontSize;
    const lineHeight = computedStyle.lineHeight;
    
    // Check for non-standard border radius
    if (borderRadius && borderRadius !== 'auto' && !['0px', '4px', '8px', '12px', '16px'].includes(borderRadius)) {
      violations.push({
        type: 'design-system-radius',
        element: el.outerHTML.substring(0, 100),
        value: borderRadius,
        selector: getSelector(el)
      });
    }
    
    // Check text contrast (simple check)
    if (el.textContent && el.textContent.length > 0) {
      const bgColor = computedStyle.backgroundColor;
      if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
        violations.push({
          type: 'contrast-check',
          element: el.tagName,
          selector: getSelector(el)
        });
      }
    }
    
    return violations;
  }
  
  function getSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.className) return '.' + el.className.split(' ')[0];
    return el.tagName.toLowerCase();
  }
  
  // Walk DOM and collect violations
  let allViolations = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.children.length === 0 && node.textContent.trim().length > 0) {
      analyzeElement(node, allViolations);
    }
  }
  
  console.log('[DETECTOR] Found violations:', allViolations.length);
  console.log('[DETECTOR] Violations:', JSON.stringify(allViolations, null, 2));
  
  // Highlight violations on overlay
  allViolations.forEach((violation, idx) => {
    const comment = document.createElement('div');
    comment.style.cssText = \`
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff6b6b;
      color: white;
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 100000;
      max-width: 300px;
      max-height: 200px;
      overflow: auto;
    \`;
    comment.textContent = \`[\${idx + 1}] \${violation.type}: \${violation.value || 'N/A'}\`;
    overlay.appendChild(comment);
  });
  
  window.__detectorFindings = allViolations;
  console.log('[DETECTOR] Overlay injection complete');
})();
`;

async function runAssessment() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = {
    timestamp: new Date().toISOString(),
    detector_scan: require('./detector-output.json'),
    browser_findings: [],
    summary: {}
  };

  try {
    for (const pageInfo of PAGES) {
      console.log(`\n📄 Testing: ${pageInfo.name}`);
      console.log(`📍 URL: ${pageInfo.url}`);

      const page = await browser.newPage();

      // Capture console messages
      const consoleLogs = [];
      page.on('console', msg => {
        consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location()
        });
      });

      // Navigate to page
      await page.goto(pageInfo.url, { waitUntil: 'networkidle2', timeout: 10000 });

      // Inject detector overlay
      await page.evaluate(DETECTOR_OVERLAY_SCRIPT);

      // Wait for detector to process
      await page.waitForTimeout(1000);

      // Extract findings from page
      const pageFindings = await page.evaluate(() => {
        return window.__detectorFindings || [];
      });

      // Get page metrics
      const metrics = await page.metrics();

      // Take screenshot
      const screenshotPath = path.join(
        __dirname,
        `assessment-b-${pageInfo.name}.png`
      );
      await page.screenshot({ path: screenshotPath, fullPage: false });

      results.browser_findings.push({
        page: pageInfo.name,
        url: pageInfo.url,
        violations_count: pageFindings.length,
        violations: pageFindings,
        console_output: consoleLogs.filter(log => log.text.includes('DETECTOR')),
        screenshot: screenshotPath,
        metrics: {
          jsHeapUsedSize: metrics.JSHeapUsedSize,
          jsHeapTotalSize: metrics.JSHeapTotalSize
        }
      });

      console.log(`✅ Found ${pageFindings.length} violations`);
      console.log(`📸 Screenshot: ${screenshotPath}`);

      await page.close();
    }

    // Generate summary
    const totalViolations = results.browser_findings.reduce(
      (sum, finding) => sum + finding.violations_count,
      0
    );

    results.summary = {
      total_pages_tested: PAGES.length,
      total_detector_scan_findings: results.detector_scan.length,
      total_browser_findings: totalViolations,
      violations_by_type: {},
      pages_with_violations: results.browser_findings.filter(f => f.violations_count > 0).map(f => f.page)
    };

    // Save results
    const outputPath = path.join(__dirname, 'assessment-b-results.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n📊 Results saved to: ${outputPath}`);

    console.log('\n' + '='.repeat(60));
    console.log('ASSESSMENT B SUMMARY');
    console.log('='.repeat(60));
    console.log(JSON.stringify(results.summary, null, 2));

  } catch (error) {
    console.error('Assessment failed:', error);
    results.error = error.message;
  } finally {
    await browser.close();
  }

  return results;
}

// Run assessment
runAssessment()
  .then(results => {
    console.log('\n✅ Assessment B Complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
