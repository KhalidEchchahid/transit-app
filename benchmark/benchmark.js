/**
 * RAPTOR Routing Engine Benchmark
 * Compares Go backend vs NestJS backend performance
 */

import autocannon from 'autocannon';
import chalk from 'chalk';
import Table from 'cli-table3';

// Configuration
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
  benchmark: {
    duration: 10, // seconds
    connections: 10, // concurrent connections
    pipelining: 1,
    warmup: {
      duration: 3,
      connections: 5,
    },
  },
};

// Test routes (various origin-destination pairs in Casablanca)
const TEST_ROUTES = [
  {
    name: 'Short Route (Mers Sultan → Garage Allal)',
    params: 'from_lat=33.5879&from_lon=-7.6339&to_lat=33.5731&to_lon=-7.5898&time=30600&day=weekday',
  },
  {
    name: 'Medium Route (North → South)',
    params: 'from_lat=33.6050&from_lon=-7.6300&to_lat=33.5600&to_lon=-7.5800&time=30600&day=weekday',
  },
  {
    name: 'Long Route (Cross-city)',
    params: 'from_lat=33.6100&from_lon=-7.6400&to_lat=33.5500&to_lon=-7.5600&time=30600&day=weekday',
  },
  {
    name: 'Tram Route Area',
    params: 'from_lat=33.5950&from_lon=-7.6100&to_lat=33.5650&to_lon=-7.5950&time=32400&day=weekday',
  },
];

// Check if server is running
async function checkServer(baseUrl, name) {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (response.ok) {
      console.log(chalk.green(`✓ ${name} is running at ${baseUrl}`));
      return true;
    }
  } catch (e) {
    console.log(chalk.red(`✗ ${name} is NOT running at ${baseUrl}`));
  }
  return false;
}

// Run warmup
async function warmup(url, config) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url,
      duration: config.warmup.duration,
      connections: config.warmup.connections,
      pipelining: 1,
    });
    
    instance.on('done', resolve);
  });
}

// Run benchmark
async function runBenchmark(url, config) {
  return new Promise((resolve) => {
    const instance = autocannon({
      url,
      duration: config.duration,
      connections: config.connections,
      pipelining: config.pipelining,
    });
    
    instance.on('done', (results) => {
      resolve({
        requests: results.requests,
        latency: results.latency,
        throughput: results.throughput,
        errors: results.errors,
        timeouts: results.timeouts,
        duration: results.duration,
        start: results.start,
        finish: results.finish,
      });
    });
  });
}

// Format number with commas
function formatNumber(num) {
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

// Print results table
function printResults(results, routeName) {
  const table = new Table({
    head: [
      chalk.white.bold('Metric'),
      chalk.cyan.bold('Go Backend'),
      chalk.magenta.bold('NestJS Backend'),
      chalk.yellow.bold('Difference'),
    ],
    colWidths: [30, 20, 20, 25],
  });
  
  const goRes = results.go;
  const nestRes = results.nest;
  
  if (goRes && nestRes) {
    // Requests per second
    const goRps = goRes.requests.average;
    const nestRps = nestRes.requests.average;
    const rpsDiff = ((goRps - nestRps) / nestRps * 100).toFixed(1);
    const rpsWinner = goRps > nestRps ? chalk.cyan('Go ↑') : chalk.magenta('NestJS ↑');
    
    table.push([
      'Requests/sec (avg)',
      formatNumber(goRps),
      formatNumber(nestRps),
      `${rpsDiff > 0 ? '+' : ''}${rpsDiff}% ${rpsWinner}`,
    ]);
    
    // Latency average
    const goLatAvg = goRes.latency.average;
    const nestLatAvg = nestRes.latency.average;
    const latDiff = ((nestLatAvg - goLatAvg) / goLatAvg * 100).toFixed(1);
    const latWinner = goLatAvg < nestLatAvg ? chalk.cyan('Go ↑') : chalk.magenta('NestJS ↑');
    
    table.push([
      'Latency avg (ms)',
      formatNumber(goLatAvg),
      formatNumber(nestLatAvg),
      `${latDiff > 0 ? '+' : ''}${latDiff}% ${latWinner}`,
    ]);
    
    // Latency p50
    table.push([
      'Latency p50 (ms)',
      formatNumber(goRes.latency.p50),
      formatNumber(nestRes.latency.p50),
      '-',
    ]);
    
    // Latency p99
    table.push([
      'Latency p99 (ms)',
      formatNumber(goRes.latency.p99),
      formatNumber(nestRes.latency.p99),
      '-',
    ]);
    
    // Latency max
    table.push([
      'Latency max (ms)',
      formatNumber(goRes.latency.max),
      formatNumber(nestRes.latency.max),
      '-',
    ]);
    
    // Throughput
    const goThroughput = goRes.throughput.average / 1024;
    const nestThroughput = nestRes.throughput.average / 1024;
    
    table.push([
      'Throughput (KB/s)',
      formatNumber(goThroughput),
      formatNumber(nestThroughput),
      '-',
    ]);
    
    // Total requests
    table.push([
      'Total Requests',
      formatNumber(goRes.requests.total),
      formatNumber(nestRes.requests.total),
      '-',
    ]);
    
    // Errors
    table.push([
      'Errors',
      goRes.errors.toString(),
      nestRes.errors.toString(),
      '-',
    ]);
  } else {
    const res = goRes || nestRes;
    const name = goRes ? 'Go Backend' : 'NestJS Backend';
    
    table.push(['Requests/sec (avg)', formatNumber(res.requests.average), '-', '-']);
    table.push(['Latency avg (ms)', formatNumber(res.latency.average), '-', '-']);
    table.push(['Latency p50 (ms)', formatNumber(res.latency.p50), '-', '-']);
    table.push(['Latency p99 (ms)', formatNumber(res.latency.p99), '-', '-']);
    table.push(['Total Requests', formatNumber(res.requests.total), '-', '-']);
  }
  
  console.log(`\n${chalk.yellow.bold(`📊 ${routeName}`)}`);
  console.log(table.toString());
}

// Main benchmark function
async function main() {
  console.log(chalk.yellow.bold(`
╔════════════════════════════════════════════════════════════════╗
║         RAPTOR Routing Engine Benchmark                        ║
║         Go Backend vs NestJS Backend                           ║
╚════════════════════════════════════════════════════════════════╝
`));

  // Check which backends are running
  console.log(chalk.yellow('Checking servers...\n'));
  
  const goRunning = await checkServer(CONFIG.go.baseUrl, CONFIG.go.name);
  const nestRunning = await checkServer(CONFIG.nest.baseUrl, CONFIG.nest.name);
  
  if (!goRunning && !nestRunning) {
    console.log(chalk.red('\nNo backends are running. Please start at least one backend.'));
    console.log(chalk.gray('  Go backend: cd backend && go run main.go'));
    console.log(chalk.gray('  NestJS backend: cd nest-backend/transit-app && pnpm run start:dev'));
    process.exit(1);
  }
  
  console.log(chalk.yellow(`\nBenchmark Configuration:`));
  console.log(chalk.gray(`  Duration: ${CONFIG.benchmark.duration}s per test`));
  console.log(chalk.gray(`  Connections: ${CONFIG.benchmark.connections} concurrent`));
  console.log(chalk.gray(`  Warmup: ${CONFIG.benchmark.warmup.duration}s`));
  
  const allResults = [];
  
  // Run benchmarks for each route
  for (const route of TEST_ROUTES) {
    console.log(chalk.yellow(`\n${'═'.repeat(60)}`));
    console.log(chalk.yellow.bold(`Testing: ${route.name}`));
    console.log(chalk.yellow(`${'═'.repeat(60)}`));
    
    const results = { go: null, nest: null };
    
    // Benchmark Go backend
    if (goRunning) {
      const goUrl = `${CONFIG.go.baseUrl}/api/v1/route?${route.params}`;
      console.log(chalk.cyan(`\nWarming up Go backend...`));
      await warmup(goUrl, CONFIG.benchmark);
      
      console.log(chalk.cyan(`Benchmarking Go backend...`));
      results.go = await runBenchmark(goUrl, CONFIG.benchmark);
    }
    
    // Benchmark NestJS backend
    if (nestRunning) {
      const nestUrl = `${CONFIG.nest.baseUrl}/api/v1/route?${route.params}`;
      console.log(chalk.magenta(`\nWarming up NestJS backend...`));
      await warmup(nestUrl, CONFIG.benchmark);
      
      console.log(chalk.magenta(`Benchmarking NestJS backend...`));
      results.nest = await runBenchmark(nestUrl, CONFIG.benchmark);
    }
    
    // Print results
    printResults(results, route.name);
    allResults.push({ route: route.name, results });
  }
  
  // Print summary
  if (goRunning && nestRunning && allResults.length > 0) {
    console.log(chalk.yellow.bold(`\n${'═'.repeat(60)}`));
    console.log(chalk.yellow.bold(`                      OVERALL SUMMARY`));
    console.log(chalk.yellow.bold(`${'═'.repeat(60)}`));
    
    let goTotalRps = 0;
    let nestTotalRps = 0;
    let goTotalLatency = 0;
    let nestTotalLatency = 0;
    let count = 0;
    
    for (const { results } of allResults) {
      if (results.go && results.nest) {
        goTotalRps += results.go.requests.average;
        nestTotalRps += results.nest.requests.average;
        goTotalLatency += results.go.latency.average;
        nestTotalLatency += results.nest.latency.average;
        count++;
      }
    }
    
    const goAvgRps = goTotalRps / count;
    const nestAvgRps = nestTotalRps / count;
    const goAvgLatency = goTotalLatency / count;
    const nestAvgLatency = nestTotalLatency / count;
    
    console.log(chalk.white(`\nAverage Requests/sec:`));
    console.log(chalk.cyan(`  Go Backend:    ${formatNumber(goAvgRps)} req/s`));
    console.log(chalk.magenta(`  NestJS Backend: ${formatNumber(nestAvgRps)} req/s`));
    
    console.log(chalk.white(`\nAverage Latency:`));
    console.log(chalk.cyan(`  Go Backend:    ${formatNumber(goAvgLatency)} ms`));
    console.log(chalk.magenta(`  NestJS Backend: ${formatNumber(nestAvgLatency)} ms`));
    
    // Determine winner
    const rpsWinner = goAvgRps > nestAvgRps ? 'Go' : 'NestJS';
    const rpsDiff = Math.abs((goAvgRps - nestAvgRps) / Math.min(goAvgRps, nestAvgRps) * 100).toFixed(1);
    
    const latencyWinner = goAvgLatency < nestAvgLatency ? 'Go' : 'NestJS';
    const latencyDiff = Math.abs((goAvgLatency - nestAvgLatency) / Math.max(goAvgLatency, nestAvgLatency) * 100).toFixed(1);
    
    console.log(chalk.yellow.bold(`\n🏆 Results:`));
    console.log(chalk.green(`   Throughput Winner: ${rpsWinner} Backend (${rpsDiff}% faster)`));
    console.log(chalk.green(`   Latency Winner: ${latencyWinner} Backend (${latencyDiff}% lower)`));
  }
  
  console.log(chalk.yellow(`\n✅ Benchmark completed!\n`));
}

main().catch(console.error);
