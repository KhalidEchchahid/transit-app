/**
 * RAPTOR Routing Engine - High Load Simulation Benchmark
 * 
 * This benchmark simulates realistic heavy traffic scenarios:
 * - Ramping up concurrent users
 * - Sustained high load
 * - Spike testing
 * - Stress testing to find breaking points
 */

import autocannon from 'autocannon';
import chalk from 'chalk';
import Table from 'cli-table3';

// Configuration for different load scenarios
const CONFIG = {
  go: {
    name: 'Go Backend',
    baseUrl: 'http://localhost:8081',
    color: chalk.cyan,
  },
  nest: {
    name: 'NestJS Backend',
    baseUrl: 'http://localhost:8080',
    color: chalk.magenta,
  },
};

// Test scenarios with increasing load
const LOAD_SCENARIOS = [
  {
    name: '🟢 Light Load (50 users)',
    description: 'Normal traffic - 50 concurrent users',
    connections: 50,
    duration: 15,
    pipelining: 1,
  },
  {
    name: '🟡 Moderate Load (200 users)',
    description: 'Peak hour traffic - 200 concurrent users',
    connections: 200,
    duration: 20,
    pipelining: 1,
  },
  {
    name: '🟠 Heavy Load (500 users)',
    description: 'High demand - 500 concurrent users',
    connections: 500,
    duration: 25,
    pipelining: 1,
  },
  {
    name: '🔴 Stress Test (1000 users)',
    description: 'Stress test - 1000 concurrent users',
    connections: 1000,
    duration: 30,
    pipelining: 1,
  },
  {
    name: '💥 Extreme Load (2000 users)',
    description: 'Breaking point test - 2000 concurrent users',
    connections: 2000,
    duration: 30,
    pipelining: 1,
  },
];

// Diverse test routes to simulate realistic usage patterns
const TEST_ROUTES = [
  { name: 'Short Urban', params: 'from_lat=33.5879&from_lon=-7.6339&to_lat=33.5731&to_lon=-7.5898&time=30600&day=weekday' },
  { name: 'Cross-City', params: 'from_lat=33.6100&from_lon=-7.6400&to_lat=33.5500&to_lon=-7.5600&time=30600&day=weekday' },
  { name: 'Tram Corridor', params: 'from_lat=33.5950&from_lon=-7.6100&to_lat=33.5650&to_lon=-7.5950&time=32400&day=weekday' },
  { name: 'Suburb-Center', params: 'from_lat=33.6200&from_lon=-7.5800&to_lat=33.5800&to_lon=-7.6200&time=28800&day=weekday' },
  { name: 'Evening Route', params: 'from_lat=33.5700&from_lon=-7.6000&to_lat=33.6000&to_lon=-7.5700&time=64800&day=weekday' },
  { name: 'Weekend Trip', params: 'from_lat=33.5850&from_lon=-7.6150&to_lat=33.5950&to_lon=-7.5850&time=36000&day=saturday' },
];

// Store results for all scenarios
const allResults = {
  go: [],
  nest: [],
};

// Check if server is running
async function checkServer(baseUrl, name) {
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      console.log(chalk.green(`✓ ${name} is running at ${baseUrl}`));
      return true;
    }
  } catch (e) {
    console.log(chalk.red(`✗ ${name} is NOT running at ${baseUrl}`));
  }
  return false;
}

// Generate random route request URL
function getRandomRouteUrl(baseUrl) {
  const route = TEST_ROUTES[Math.floor(Math.random() * TEST_ROUTES.length)];
  return `${baseUrl}/api/v1/route?${route.params}`;
}

// Create autocannon request generator for diverse routes
function createRequestGenerator(baseUrl) {
  return function* () {
    while (true) {
      const route = TEST_ROUTES[Math.floor(Math.random() * TEST_ROUTES.length)];
      yield {
        method: 'GET',
        path: `/api/v1/route?${route.params}`,
      };
    }
  };
}

// Run warmup
async function warmup(baseUrl, connections = 20) {
  return new Promise((resolve) => {
    console.log(chalk.gray(`  Warming up with ${connections} connections for 5s...`));
    const instance = autocannon({
      url: baseUrl,
      connections,
      duration: 5,
      requests: [
        { method: 'GET', path: `/api/v1/route?${TEST_ROUTES[0].params}` },
      ],
    });
    instance.on('done', resolve);
  });
}

// Run a single load scenario
async function runScenario(baseUrl, scenario) {
  return new Promise((resolve, reject) => {
    const results = {
      scenario: scenario.name,
      connections: scenario.connections,
      duration: scenario.duration,
      requests: null,
      latency: null,
      throughput: null,
      errors: 0,
      timeouts: 0,
      non2xx: 0,
    };

    // Use rotating requests for diverse load
    const requestsIterator = createRequestGenerator(baseUrl);
    
    const instance = autocannon({
      url: baseUrl,
      connections: scenario.connections,
      duration: scenario.duration,
      pipelining: scenario.pipelining,
      requests: [
        ...TEST_ROUTES.map(r => ({ method: 'GET', path: `/api/v1/route?${r.params}` })),
      ],
    });

    // Track progress
    let lastReported = 0;
    instance.on('tick', () => {
      const current = instance.opts.duration - Math.ceil((instance.opts.duration * instance.remaining) / 1000);
      if (current > lastReported) {
        process.stdout.write(chalk.gray(`.`));
        lastReported = current;
      }
    });

    instance.on('done', (rawResults) => {
      process.stdout.write('\n');
      results.requests = rawResults.requests;
      results.latency = rawResults.latency;
      results.throughput = rawResults.throughput;
      results.errors = rawResults.errors;
      results.timeouts = rawResults.timeouts;
      results.non2xx = rawResults.non2xx || 0;
      resolve(results);
    });

    instance.on('error', (err) => {
      reject(err);
    });
  });
}

// Format number with commas
function formatNumber(num, decimals = 2) {
  return num.toLocaleString('en-US', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
}

// Print scenario results
function printScenarioResults(goResult, nestResult, scenario) {
  console.log(chalk.yellow(`\n📊 Results for: ${scenario.name}`));
  console.log(chalk.gray(`   ${scenario.description}\n`));

  const table = new Table({
    head: [
      chalk.white.bold('Metric'),
      chalk.cyan.bold('Go'),
      chalk.magenta.bold('NestJS'),
      chalk.yellow.bold('Winner'),
    ],
    colWidths: [25, 18, 18, 20],
  });

  const addRow = (metric, goVal, nestVal, lowerIsBetter = false) => {
    if (goVal === null || nestVal === null) {
      const val = goVal ?? nestVal;
      table.push([metric, goVal ?? '-', nestVal ?? '-', '-']);
      return;
    }
    
    let winner, diff;
    if (lowerIsBetter) {
      winner = goVal <= nestVal ? 'Go ↑' : 'NestJS ↑';
      diff = ((Math.max(goVal, nestVal) - Math.min(goVal, nestVal)) / Math.max(goVal, nestVal) * 100).toFixed(1);
    } else {
      winner = goVal >= nestVal ? 'Go ↑' : 'NestJS ↑';
      diff = ((Math.max(goVal, nestVal) - Math.min(goVal, nestVal)) / Math.min(goVal, nestVal) * 100).toFixed(1);
    }
    
    const winnerColored = winner.startsWith('Go') ? chalk.cyan(winner) : chalk.magenta(winner);
    table.push([metric, formatNumber(goVal), formatNumber(nestVal), `${diff}% ${winnerColored}`]);
  };

  // Key metrics
  addRow('Requests/sec (avg)', goResult?.requests?.average, nestResult?.requests?.average);
  addRow('Requests/sec (max)', goResult?.requests?.max, nestResult?.requests?.max);
  addRow('Total Requests', goResult?.requests?.total, nestResult?.requests?.total);
  addRow('Latency avg (ms)', goResult?.latency?.average, nestResult?.latency?.average, true);
  addRow('Latency p50 (ms)', goResult?.latency?.p50, nestResult?.latency?.p50, true);
  addRow('Latency p90 (ms)', goResult?.latency?.p90, nestResult?.latency?.p90, true);
  addRow('Latency p99 (ms)', goResult?.latency?.p99, nestResult?.latency?.p99, true);
  addRow('Latency max (ms)', goResult?.latency?.max, nestResult?.latency?.max, true);
  
  // Errors
  const goErrors = (goResult?.errors || 0) + (goResult?.timeouts || 0) + (goResult?.non2xx || 0);
  const nestErrors = (nestResult?.errors || 0) + (nestResult?.timeouts || 0) + (nestResult?.non2xx || 0);
  table.push([
    'Errors/Timeouts',
    goErrors.toString(),
    nestErrors.toString(),
    goErrors <= nestErrors ? chalk.cyan('Go ↑') : chalk.magenta('NestJS ↑'),
  ]);

  // Throughput
  const goThroughput = (goResult?.throughput?.average || 0) / 1024;
  const nestThroughput = (nestResult?.throughput?.average || 0) / 1024;
  addRow('Throughput (KB/s)', goThroughput, nestThroughput);

  console.log(table.toString());

  // Health assessment
  const goErrorRate = goResult?.requests?.total > 0 
    ? (goErrors / goResult.requests.total * 100) : 0;
  const nestErrorRate = nestResult?.requests?.total > 0 
    ? (nestErrors / nestResult.requests.total * 100) : 0;

  console.log(chalk.white('\n📈 Health Assessment:'));
  
  const assessHealth = (name, errorRate, p99, color) => {
    if (errorRate > 5 || p99 > 5000) {
      console.log(color(`   ${name}: ${chalk.red('❌ DEGRADED')} - Error rate: ${errorRate.toFixed(2)}%, P99: ${p99}ms`));
    } else if (errorRate > 1 || p99 > 2000) {
      console.log(color(`   ${name}: ${chalk.yellow('⚠️  STRESSED')} - Error rate: ${errorRate.toFixed(2)}%, P99: ${p99}ms`));
    } else {
      console.log(color(`   ${name}: ${chalk.green('✅ HEALTHY')} - Error rate: ${errorRate.toFixed(2)}%, P99: ${p99}ms`));
    }
  };

  if (goResult) assessHealth('Go Backend', goErrorRate, goResult?.latency?.p99 || 0, chalk.cyan);
  if (nestResult) assessHealth('NestJS Backend', nestErrorRate, nestResult?.latency?.p99 || 0, chalk.magenta);
}

// Print final summary
function printFinalSummary() {
  console.log(chalk.yellow.bold(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                            LOAD SIMULATION SUMMARY                              ║
╚════════════════════════════════════════════════════════════════════════════════╝
`));

  const summaryTable = new Table({
    head: [
      chalk.white.bold('Load Level'),
      chalk.cyan.bold('Go RPS'),
      chalk.cyan.bold('Go P99'),
      chalk.magenta.bold('Nest RPS'),
      chalk.magenta.bold('Nest P99'),
      chalk.yellow.bold('RPS Winner'),
    ],
    colWidths: [25, 12, 12, 12, 12, 15],
  });

  for (let i = 0; i < LOAD_SCENARIOS.length; i++) {
    const goRes = allResults.go[i];
    const nestRes = allResults.nest[i];
    
    const goRps = goRes?.requests?.average ?? 0;
    const goP99 = goRes?.latency?.p99 ?? 0;
    const nestRps = nestRes?.requests?.average ?? 0;
    const nestP99 = nestRes?.latency?.p99 ?? 0;
    
    const winner = goRps > nestRps ? chalk.cyan('Go') : (goRps < nestRps ? chalk.magenta('NestJS') : 'Tie');
    
    summaryTable.push([
      LOAD_SCENARIOS[i].name.split('(')[0].trim(),
      formatNumber(goRps, 0),
      `${formatNumber(goP99, 0)}ms`,
      formatNumber(nestRps, 0),
      `${formatNumber(nestP99, 0)}ms`,
      winner,
    ]);
  }

  console.log(summaryTable.toString());

  // Calculate overall statistics
  const goAvgRps = allResults.go.reduce((sum, r) => sum + (r?.requests?.average || 0), 0) / allResults.go.length;
  const nestAvgRps = allResults.nest.reduce((sum, r) => sum + (r?.requests?.average || 0), 0) / allResults.nest.length;
  const goAvgP99 = allResults.go.reduce((sum, r) => sum + (r?.latency?.p99 || 0), 0) / allResults.go.length;
  const nestAvgP99 = allResults.nest.reduce((sum, r) => sum + (r?.latency?.p99 || 0), 0) / allResults.nest.length;

  console.log(chalk.white.bold('\n📊 Overall Performance:'));
  console.log(chalk.cyan(`   Go Backend:`));
  console.log(chalk.cyan(`      Average RPS across all loads: ${formatNumber(goAvgRps, 0)}`));
  console.log(chalk.cyan(`      Average P99 latency: ${formatNumber(goAvgP99, 0)}ms`));
  console.log(chalk.magenta(`   NestJS Backend:`));
  console.log(chalk.magenta(`      Average RPS across all loads: ${formatNumber(nestAvgRps, 0)}`));
  console.log(chalk.magenta(`      Average P99 latency: ${formatNumber(nestAvgP99, 0)}ms`));

  const performanceRatio = goAvgRps / nestAvgRps;
  console.log(chalk.yellow.bold(`\n🏆 Conclusion:`));
  if (performanceRatio > 1.1) {
    console.log(chalk.green(`   Go backend is ${formatNumber(performanceRatio, 1)}x faster than NestJS on average`));
  } else if (performanceRatio < 0.9) {
    console.log(chalk.green(`   NestJS backend is ${formatNumber(1/performanceRatio, 1)}x faster than Go on average`));
  } else {
    console.log(chalk.green(`   Both backends perform similarly under load`));
  }
}

// Spike test - sudden traffic surge
async function runSpikeTest(goRunning, nestRunning) {
  console.log(chalk.yellow.bold(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                              SPIKE TEST                                         ║
║              Simulating sudden traffic surge (0 → 500 → 0 users)               ║
╚════════════════════════════════════════════════════════════════════════════════╝
`));

  const spikePhases = [
    { name: 'Baseline', connections: 10, duration: 5 },
    { name: 'Spike Up', connections: 500, duration: 10 },
    { name: 'Peak Hold', connections: 500, duration: 10 },
    { name: 'Recovery', connections: 50, duration: 10 },
    { name: 'Back to Normal', connections: 10, duration: 5 },
  ];

  for (const phase of spikePhases) {
    console.log(chalk.yellow(`\n⚡ Phase: ${phase.name} (${phase.connections} connections, ${phase.duration}s)`));
    
    const results = { go: null, nest: null };
    
    if (goRunning) {
      process.stdout.write(chalk.cyan('   Go: '));
      results.go = await runScenario(CONFIG.go.baseUrl, phase);
      console.log(chalk.cyan(`   → ${formatNumber(results.go.requests.average)} req/s, P99: ${results.go.latency.p99}ms`));
    }
    
    if (nestRunning) {
      process.stdout.write(chalk.magenta('   NestJS: '));
      results.nest = await runScenario(CONFIG.nest.baseUrl, phase);
      console.log(chalk.magenta(`   → ${formatNumber(results.nest.requests.average)} req/s, P99: ${results.nest.latency.p99}ms`));
    }
  }
}

// Main function
async function main() {
  console.log(chalk.yellow.bold(`
╔════════════════════════════════════════════════════════════════════════════════╗
║            🚀 RAPTOR Routing Engine - HIGH LOAD SIMULATION 🚀                   ║
║                                                                                 ║
║   This benchmark simulates realistic heavy traffic with:                        ║
║   • 50 to 2000 concurrent users                                                 ║
║   • Multiple route queries (short, cross-city, tram, suburban)                  ║
║   • Different times of day and days of week                                     ║
║   • Spike testing for traffic surge resilience                                  ║
╚════════════════════════════════════════════════════════════════════════════════╝
`));

  // Check servers
  console.log(chalk.yellow('🔍 Checking servers...\n'));
  const goRunning = await checkServer(CONFIG.go.baseUrl, CONFIG.go.name);
  const nestRunning = await checkServer(CONFIG.nest.baseUrl, CONFIG.nest.name);

  if (!goRunning && !nestRunning) {
    console.log(chalk.red('\n❌ No backends are running. Please start at least one backend.'));
    console.log(chalk.gray('   Go backend:    cd backend && go run main.go'));
    console.log(chalk.gray('   NestJS backend: cd nest-backend/transit-app && pnpm run start'));
    process.exit(1);
  }

  // Warmup phase
  console.log(chalk.yellow('\n🔥 Warming up servers...\n'));
  if (goRunning) await warmup(CONFIG.go.baseUrl);
  if (nestRunning) await warmup(CONFIG.nest.baseUrl);

  // Run load scenarios
  console.log(chalk.yellow.bold(`
╔════════════════════════════════════════════════════════════════════════════════╗
║                         PROGRESSIVE LOAD TEST                                   ║
╚════════════════════════════════════════════════════════════════════════════════╝
`));

  for (let i = 0; i < LOAD_SCENARIOS.length; i++) {
    const scenario = LOAD_SCENARIOS[i];
    console.log(chalk.yellow(`\n${'═'.repeat(80)}`));
    console.log(chalk.yellow.bold(`  ${scenario.name}`));
    console.log(chalk.gray(`  ${scenario.description}`));
    console.log(chalk.gray(`  Duration: ${scenario.duration}s, Connections: ${scenario.connections}`));
    console.log(chalk.yellow(`${'═'.repeat(80)}`));

    let goResult = null;
    let nestResult = null;

    if (goRunning) {
      process.stdout.write(chalk.cyan(`\n  ▶ Testing Go Backend`));
      goResult = await runScenario(CONFIG.go.baseUrl, scenario);
    }

    if (nestRunning) {
      process.stdout.write(chalk.magenta(`\n  ▶ Testing NestJS Backend`));
      nestResult = await runScenario(CONFIG.nest.baseUrl, scenario);
    }

    allResults.go.push(goResult);
    allResults.nest.push(nestResult);

    printScenarioResults(goResult, nestResult, scenario);

    // Cool down between scenarios
    if (i < LOAD_SCENARIOS.length - 1) {
      console.log(chalk.gray('\n  ⏳ Cooling down for 5 seconds before next scenario...'));
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // Run spike test
  await runSpikeTest(goRunning, nestRunning);

  // Print final summary
  printFinalSummary();

  console.log(chalk.green('\n✅ Load simulation completed!\n'));
}

main().catch((err) => {
  console.error(chalk.red('Benchmark failed:'), err);
  process.exit(1);
});
